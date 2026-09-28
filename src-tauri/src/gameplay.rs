//! Deterministic reconstruction of replay state. Never reads the game process or watches files.
//! Positions/velocities in uu; blue defends -Y. Time is relative to the first recorded frame.
use crate::{
    metadata::{self, ReplayMetadata},
    player::{self, PlayerTarget},
};
use boxcars::{Attribute, HeaderProp, ParserBuilder, Replay, RigidBody, Vector3f};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};

const MAX_FRAMES: usize = 100_000;
const MAX_SECONDS: f64 = 1800.0;
const BODY_MAX_AGE: f64 = 0.5;
const MAX_EVIDENCE: usize = 180;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameplayMetric {
    pub key: String,
    pub label: String,
    pub value: Option<f64>,
    pub unit: String,
    pub measured_seconds: f64,
    pub method: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Quality {
    pub decoded_frames: usize,
    pub recording_seconds: f64,
    pub active_seconds: f64,
    pub target_observed_seconds: f64,
    pub spatial_observed_seconds: f64,
    pub coverage_percent: f64,
    pub complete_spatial_percent: f64,
    pub timeline_interval_seconds: f64,
    pub timeline_samples: usize,
    pub standard_soccar: bool,
    pub can_assess: bool,
    pub warnings: Vec<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CarSample {
    pub player: usize,
    pub p: [i32; 3],
    pub v: Option<[i32; 3]>,
    pub boost: Option<f64>,
    pub boosting: Option<bool>,
    pub q: [f64; 4],
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub time: f64,
    pub clock: Option<i32>,
    pub phase: String,
    pub ball: Option<[i32; 3]>,
    pub ball_velocity: Option<[i32; 3]>,
    pub cars: Vec<CarSample>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub id: String,
    pub time: f64,
    pub end_time: f64,
    pub kind: String,
    pub facts: String,
    pub heuristic: bool,
    pub context: Snapshot,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameplayDossier {
    pub version: u8,
    pub target: usize,
    pub quality: Quality,
    pub metrics: Vec<GameplayMetric>,
    pub evidence: Vec<Evidence>,
    pub timeline: Vec<Snapshot>,
    pub key_sequences: Vec<Snapshot>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameplayPreview {
    pub quality: Quality,
    pub metrics: Vec<GameplayMetric>,
    pub evidence: Vec<Evidence>,
    pub payload_bytes: usize,
}
impl GameplayDossier {
    pub fn preview(&self) -> GameplayPreview {
        GameplayPreview {
            quality: self.quality.clone(),
            metrics: self.metrics.clone(),
            evidence: self.evidence.clone(),
            payload_bytes: serde_json::to_vec(self).map_or(0, |bytes| bytes.len()),
        }
    }
    pub fn evidence(&self, id: &str) -> Option<&Evidence> {
        self.evidence.iter().find(|e| e.id == id)
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
enum Kind {
    Car,
    Ball,
    Boost,
    Team(u8),
    #[default]
    Other,
}
#[derive(Default)]
struct Actor {
    kind: Kind,
    name: Option<String>,
    team_actor: Option<i32>,
    pri: Option<i32>,
    vehicle: Option<i32>,
    body: Option<RigidBody>,
    body_at: f64,
    boost: Option<f64>,
    boost_active: Option<bool>,
    counters: [Option<i32>; 4],
}
#[derive(Default)]
struct State {
    actors: HashMap<i32, Actor>,
    phase: Option<String>,
    clock: Option<i32>,
}
fn rounded(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}
fn vec(v: Vector3f) -> [i32; 3] {
    [v.x.round() as i32, v.y.round() as i32, v.z.round() as i32]
}
fn finite(v: Vector3f) -> bool {
    [v.x, v.y, v.z]
        .iter()
        .all(|v| v.is_finite() && v.abs() < 100_000.0)
}
fn valid_body(body: &RigidBody) -> bool {
    finite(body.location)
        && body.linear_velocity.is_none_or(finite)
        && [
            body.rotation.x,
            body.rotation.y,
            body.rotation.z,
            body.rotation.w,
        ]
        .iter()
        .all(|v| v.is_finite())
}
fn magnitude(v: Vector3f) -> f64 {
    f64::from(v.x).hypot(f64::from(v.y)).hypot(f64::from(v.z))
}
fn distance(a: [i32; 3], b: [i32; 3]) -> f64 {
    f64::from(a[0] - b[0])
        .hypot(f64::from(a[1] - b[1]))
        .hypot(f64::from(a[2] - b[2]))
}
fn classify(name: &str) -> Kind {
    if name.contains("Archetypes.Car.") {
        Kind::Car
    } else if name.contains("Archetypes.Ball.") {
        Kind::Ball
    } else if name.contains("CarComponent_Boost") || name.ends_with(":CarArchetype.Boost") {
        Kind::Boost
    } else if name == "Archetypes.Teams.Team0" {
        Kind::Team(0)
    } else if name == "Archetypes.Teams.Team1" {
        Kind::Team(1)
    } else {
        Kind::Other
    }
}
impl State {
    fn player_index(&self, car: &Actor, metadata: &ReplayMetadata) -> Option<usize> {
        let pri = self.actors.get(&car.pri?)?;
        let team = match self.actors.get(&pri.team_actor?)?.kind {
            Kind::Team(team) => team,
            _ => return None,
        };
        let mut matches = metadata
            .players
            .iter()
            .enumerate()
            .filter(|(_, p)| Some(&p.name) == pri.name.as_ref() && p.team == Some(team));
        let index = matches.next()?.0;
        matches.next().is_none().then_some(index)
    }
    fn sample(&self, time: f64, origin: f64, metadata: &ReplayMetadata) -> Snapshot {
        let mut cars = Vec::new();
        let mut duplicated = HashSet::new();
        for (id, actor) in &self.actors {
            if actor.kind != Kind::Car {
                continue;
            }
            let Some(body) = actor
                .body
                .filter(|body| body.sleeping || time - actor.body_at <= BODY_MAX_AGE)
            else {
                continue;
            };
            let Some(index) = self.player_index(actor, metadata) else {
                continue;
            };
            if cars.iter().any(|car: &CarSample| car.player == index) {
                duplicated.insert(index);
                continue;
            }
            let boosts: Vec<_> = self
                .actors
                .values()
                .filter(|component| component.kind == Kind::Boost && component.vehicle == Some(*id))
                .collect();
            let boost = (boosts.len() == 1).then(|| boosts[0]);
            let q = body.rotation;
            cars.push(CarSample {
                player: index,
                p: vec(body.location),
                v: body
                    .linear_velocity
                    .or_else(|| {
                        body.sleeping.then_some(Vector3f {
                            x: 0.0,
                            y: 0.0,
                            z: 0.0,
                        })
                    })
                    .map(vec),
                boost: boost.and_then(|b| b.boost).map(rounded),
                boosting: boost.and_then(|b| b.boost_active),
                q: [q.x, q.y, q.z, q.w].map(|v| (f64::from(v) * 1000.0).round() / 1000.0),
            });
        }
        cars.retain(|c| !duplicated.contains(&c.player));
        cars.sort_by_key(|c| c.player);
        let balls: Vec<_> = self
            .actors
            .values()
            .filter(|a| a.kind == Kind::Ball)
            .filter_map(|a| {
                a.body
                    .filter(|b| b.sleeping || time - a.body_at <= BODY_MAX_AGE)
            })
            .collect();
        let ball = (balls.len() == 1).then(|| balls[0]);
        Snapshot {
            time: rounded(time - origin),
            clock: self.clock,
            phase: self.phase.clone().unwrap_or_else(|| "unknown".into()),
            ball: ball.map(|b| vec(b.location)),
            ball_velocity: ball
                .and_then(|b| {
                    b.linear_velocity.or_else(|| {
                        b.sleeping.then_some(Vector3f {
                            x: 0.0,
                            y: 0.0,
                            z: 0.0,
                        })
                    })
                })
                .map(vec),
            cars,
        }
    }
    fn apply(&mut self, frame: &boxcars::Frame, replay: &Replay) {
        for deleted in &frame.deleted_actors {
            self.actors.remove(&deleted.0);
        }
        for new in &frame.new_actors {
            let kind = usize::try_from(new.object_id.0)
                .ok()
                .and_then(|i| replay.objects.get(i))
                .map(|s| classify(s))
                .unwrap_or_default();
            // An actor ID can be reused after destruction. Never retain its previous identity/body.
            self.actors.insert(
                new.actor_id.0,
                Actor {
                    kind,
                    ..Actor::default()
                },
            );
        }
        for update in &frame.updated_actors {
            let Some(property) = usize::try_from(update.object_id.0)
                .ok()
                .and_then(|i| replay.objects.get(i))
            else {
                continue;
            };
            if property == "TAGame.GameEvent_TA:ReplicatedStateName" {
                if let Attribute::Int(value) = update.attribute {
                    self.phase = usize::try_from(value)
                        .ok()
                        .and_then(|i| replay.names.get(i))
                        .filter(|name| {
                            [
                                "Active",
                                "Countdown",
                                "PostGoalScored",
                                "Ended",
                                "Waiting",
                                "Replay",
                                "OverTime",
                            ]
                            .contains(&name.as_str())
                        })
                        .cloned();
                }
            }
            if property == "TAGame.GameEvent_Soccar_TA:SecondsRemaining" {
                if let Attribute::Int(value) = update.attribute {
                    self.clock = (value >= 0).then_some(value);
                }
            }
            let Some(actor) = self.actors.get_mut(&update.actor_id.0) else {
                continue;
            };
            match (property.as_str(), &update.attribute) {
                ("Engine.PlayerReplicationInfo:PlayerName", Attribute::String(name)) => {
                    actor.name = Some(name.clone())
                }
                ("Engine.PlayerReplicationInfo:Team", Attribute::ActiveActor(link)) => {
                    actor.team_actor = link.active.then_some(link.actor.0)
                }
                ("Engine.Pawn:PlayerReplicationInfo", Attribute::ActiveActor(link)) => {
                    actor.pri = link.active.then_some(link.actor.0)
                }
                ("TAGame.CarComponent_TA:Vehicle", Attribute::ActiveActor(link)) => {
                    actor.vehicle = link.active.then_some(link.actor.0)
                }
                ("TAGame.RBActor_TA:ReplicatedRBState", Attribute::RigidBody(body)) => {
                    actor.body = valid_body(body).then_some(*body);
                    actor.body_at = f64::from(frame.time);
                }
                ("TAGame.CarComponent_Boost_TA:ReplicatedBoostAmount", Attribute::Byte(amount)) => {
                    actor.boost = Some(f64::from(*amount) * 100.0 / 255.0)
                }
                (
                    "TAGame.CarComponent_Boost_TA:ReplicatedBoost",
                    Attribute::ReplicatedBoost(boost),
                ) => actor.boost = Some(f64::from(boost.boost_amount) * 100.0 / 255.0),
                ("TAGame.CarComponent_TA:ReplicatedActive", Attribute::Byte(value))
                    if actor.kind == Kind::Boost =>
                {
                    actor.boost_active = Some(value % 2 == 1)
                }
                ("TAGame.PRI_TA:MatchShots", Attribute::Int(value)) => {
                    actor.counters[0] = (*value >= 0).then_some(*value)
                }
                ("TAGame.PRI_TA:MatchSaves", Attribute::Int(value)) => {
                    actor.counters[1] = (*value >= 0).then_some(*value)
                }
                ("TAGame.PRI_TA:MatchGoals", Attribute::Int(value)) => {
                    actor.counters[2] = (*value >= 0).then_some(*value)
                }
                ("TAGame.PRI_TA:MatchDemolishes", Attribute::Int(value)) => {
                    actor.counters[3] = (*value >= 0).then_some(*value)
                }
                _ => {}
            }
        }
    }
}

#[derive(Default)]
struct Weighted {
    total: f64,
    seconds: f64,
}
impl Weighted {
    fn add(&mut self, value: f64, dt: f64) {
        if value.is_finite() && dt > 0.0 {
            self.total += value * dt;
            self.seconds += dt;
        }
    }
    fn mean(&self) -> Option<f64> {
        (self.seconds > 0.0).then(|| rounded(self.total / self.seconds))
    }
    fn metric(&self, key: &str, label: &str, unit: &str, method: &str) -> GameplayMetric {
        GameplayMetric {
            key: key.into(),
            label: label.into(),
            value: self.mean(),
            unit: unit.into(),
            measured_seconds: rounded(self.seconds),
            method: method.into(),
        }
    }
}
#[derive(Default)]
struct Aggregates {
    observed: f64,
    spatial: f64,
    speed: Weighted,
    slow: Weighted,
    fast: Weighted,
    boost: Weighted,
    low_boost: Weighted,
    zero_boost: Weighted,
    boosting: Weighted,
    boost_at_speed: Weighted,
    offensive: Weighted,
    defensive_third: Weighted,
    behind_ball: Weighted,
    last_back: Weighted,
    ball_distance: Weighted,
    team_distance: Weighted,
    height: Weighted,
    spatial_conditions: [bool; 3],
}
impl Aggregates {
    fn add(
        &mut self,
        sample: &Snapshot,
        dt: f64,
        metadata: &ReplayMetadata,
        target: &PlayerTarget,
        standard: bool,
    ) {
        self.spatial_conditions = [false; 3];
        let Some(car) = sample.cars.iter().find(|c| c.player == target.index) else {
            return;
        };
        self.observed += dt;
        self.height.add(f64::from(car.p[2]), dt);
        if let Some(v) = car.v {
            let speed = magnitude(Vector3f {
                x: v[0] as f32,
                y: v[1] as f32,
                z: v[2] as f32,
            });
            self.speed.add(speed, dt);
            self.slow.add(if speed < 500.0 { 100.0 } else { 0.0 }, dt);
            self.fast.add(if speed >= 2200.0 { 100.0 } else { 0.0 }, dt);
            if let Some(active) = car.boosting {
                self.boost_at_speed.add(
                    if active && speed >= 2200.0 {
                        100.0
                    } else {
                        0.0
                    },
                    dt,
                );
            }
        }
        if let Some(boost) = car.boost {
            self.boost.add(boost, dt);
            self.low_boost
                .add(if boost < 20.0 { 100.0 } else { 0.0 }, dt);
            self.zero_boost
                .add(if boost < 1.0 { 100.0 } else { 0.0 }, dt);
        }
        if let Some(active) = car.boosting {
            self.boosting.add(if active { 100.0 } else { 0.0 }, dt);
        }
        let Some(team) = target.team else {
            return;
        };
        if !standard {
            return;
        }
        let direction = if team == 0 { 1.0 } else { -1.0 };
        let y = f64::from(car.p[1]) * direction;
        self.offensive.add(if y > 0.0 { 100.0 } else { 0.0 }, dt);
        self.defensive_third
            .add(if y < -1706.7 { 100.0 } else { 0.0 }, dt);
        let Some(ball) = sample.ball else {
            return;
        };
        let ball_y = f64::from(ball[1]) * direction;
        self.ball_distance.add(distance(car.p, ball), dt);
        self.behind_ball
            .add(if y <= ball_y { 100.0 } else { 0.0 }, dt);
        let teammates: Vec<_> = sample
            .cars
            .iter()
            .filter(|c| c.player != target.index && metadata.players[c.player].team == Some(team))
            .collect();
        let expected = metadata
            .players
            .iter()
            .filter(|p| p.team == Some(team))
            .count();
        // Missing teammates must not turn someone into "last defender" by default.
        if teammates.len() + 1 != expected {
            return;
        }
        let mut last = true;
        let mut near_ball = false;
        let mut nearest = f64::INFINITY;
        for mate in &teammates {
            let mate_y = f64::from(mate.p[1]) * direction;
            last &= y <= mate_y;
            near_ball |= distance(mate.p, ball) < 700.0;
            nearest = nearest.min(distance(car.p, mate.p));
        }
        self.last_back.add(if last { 100.0 } else { 0.0 }, dt);
        if nearest.is_finite() {
            self.team_distance.add(nearest, dt);
        }
        // Spatial heuristics, never labeled confirmed double commits or a causal mistake.
        self.spatial_conditions[0] = near_ball && distance(car.p, ball) < 700.0 && nearest < 900.0;
        self.spatial_conditions[1] = last && y > ball_y + 300.0 && ball_y < 0.0;
        self.spatial_conditions[2] = nearest < 500.0;
        if sample.cars.len() == metadata.players.len() {
            self.spatial += dt;
        }
    }
    fn metrics(&self) -> Vec<GameplayMetric> {
        let frame_method = "Moyenne pondérée par dt des frames actives, données manquantes exclues ; dernier état réseau maintenu au plus 0,5 s sauf corps endormi.";
        let boost_method = "Dernier boost répliqué maintenu entre mises à jour (0–255 converti en %), pas une mesure continue du réservoir.";
        vec![
            self.speed.metric("meanSpeed","Vitesse moyenne","uu/s",frame_method),
            self.slow.metric("slowPercent","Temps à moins de 500 uu/s","%",frame_method),
            self.fast.metric("supersonicPercent","Temps à ≥ 2 200 uu/s","%",frame_method),
            self.boost.metric("meanBoost","Boost répliqué moyen","/100",boost_method),
            self.low_boost.metric("lowBoostPercent","Temps boost répliqué < 20","%",boost_method),
            self.zero_boost.metric("zeroBoostPercent","Temps boost répliqué quasi nul","%",boost_method),
            self.boosting.metric("boostActivePercent","Temps boost activé","%","Bit de parité ReplicatedActive du composant boost, frames actives."),
            self.boost_at_speed.metric("boostAtSupersonicPercent","Boost activé à ≥ 2 200 uu/s","%",frame_method),
            self.offensive.metric("offensiveHalfPercent","Temps dans la moitié offensive","%",frame_method),
            self.defensive_third.metric("defensiveThirdPercent","Temps dans le tiers défensif","%",frame_method),
            self.behind_ball.metric("behindBallPercent","Temps côté but propre par rapport au ballon","%",frame_method),
            self.last_back.metric("lastBackPercent","Dernier coéquipier selon axe Y","%","Comparaison des Y orientés, uniquement lorsque tous les coéquipiers sont présents ; ce n'est pas un rôle tactique garanti."),
            self.ball_distance.metric("meanBallDistance","Distance moyenne au ballon","uu",frame_method),
            self.team_distance.metric("meanNearestTeammateDistance","Distance au coéquipier le plus proche","uu",frame_method),
            self.height.metric("meanHeight","Hauteur moyenne","uu",frame_method),
        ]
    }
}

#[derive(Default)]
struct Run {
    start: Option<Snapshot>,
    last: Option<Snapshot>,
    seconds: f64,
    emitted: bool,
    evidence_index: Option<usize>,
}
impl Run {
    fn step(
        &mut self,
        condition: bool,
        sample: &Snapshot,
        dt: f64,
        kind: &str,
        facts: &str,
        evidence: &mut Vec<Evidence>,
    ) {
        if condition {
            if self.start.is_none() {
                self.start = Some(sample.clone());
            }
            self.last = Some(sample.clone());
            self.seconds += dt;
            if !self.emitted
                && self.seconds >= 1.0
                && evidence.iter().filter(|e| e.heuristic).count() < 60
                && evidence.len() < MAX_EVIDENCE - 20
            {
                let start = self.start.as_ref().unwrap();
                evidence.push(Evidence {
                    id: format!("E{}", evidence.len() + 1),
                    time: start.time,
                    end_time: sample.time,
                    kind: kind.into(),
                    facts: facts.into(),
                    heuristic: true,
                    context: sample.clone(),
                });
                self.evidence_index = Some(evidence.len() - 1);
                self.emitted = true;
            } else if self.emitted {
                if let Some(last) = self
                    .evidence_index
                    .and_then(|index| evidence.get_mut(index))
                {
                    last.end_time = sample.time;
                }
            }
        } else {
            *self = Self::default();
        }
    }
}

pub fn parse_file(
    path: &Path,
    target: &PlayerTarget,
) -> Result<(ReplayMetadata, GameplayDossier), String> {
    let size = std::fs::metadata(path)
        .map_err(|_| "Replay inaccessible.".to_string())?
        .len();
    if size > 32 * 1024 * 1024 {
        return Err("Le décodage gameplay est limité aux replays de 32 Mio.".into());
    }
    let bytes = metadata::read_file(path)?;
    if bytes.len() > 32 * 1024 * 1024 {
        return Err("Le décodage gameplay est limité aux replays de 32 Mio.".into());
    }
    let replay = ParserBuilder::new(&bytes).always_check_crc().must_parse_network_data().parse()
        .map_err(|_| "Frames gameplay illisibles ou incompatibles. Aucun coaching ni appel IA ne sera lancé avec les seuls compteurs.".to_string())?;
    let metadata = metadata::extract_metadata(&replay.properties);
    player::validate_target(&metadata.players, target)?;
    let dossier = extract(&replay, &metadata, target)?;
    Ok((metadata, dossier))
}

fn goal_evidence(
    replay: &Replay,
    frame: usize,
    sample: &Snapshot,
    target: &PlayerTarget,
    evidence: &mut Vec<Evidence>,
) {
    let Some(HeaderProp::Array(goals)) = replay
        .properties
        .iter()
        .find(|(key, _)| key == "Goals")
        .map(|(_, value)| value)
    else {
        return;
    };
    for goal in goals {
        let goal_frame = goal
            .iter()
            .find(|(k, _)| k == "frame")
            .and_then(|(_, v)| v.as_i32())
            .and_then(|v| usize::try_from(v).ok());
        if goal_frame != Some(frame) {
            continue;
        }
        let team = goal
            .iter()
            .find(|(k, _)| k == "PlayerTeam")
            .and_then(|(_, v)| v.as_i32());
        let scored = team.and_then(|v| u8::try_from(v).ok()) == target.team;
        if evidence.len() < MAX_EVIDENCE {
            evidence.push(Evidence { id:format!("E{}",evidence.len()+1), time:sample.time,end_time:sample.time,kind:if scored {"team_goal"} else {"opponent_goal"}.into(), facts:format!("But listé dans Goals à la frame {frame}, équipe {:?}. Le joueur ciblé n'est pas nécessairement le buteur ; comparer les positions des secondes précédentes, sans attribuer automatiquement la responsabilité d'un but encaissé.",team),heuristic:false,context:sample.clone() });
        }
    }
}

pub fn extract(
    replay: &Replay,
    metadata: &ReplayMetadata,
    target: &PlayerTarget,
) -> Result<GameplayDossier, String> {
    if replay.net_version.unwrap_or(0) < 7 {
        return Err("Ancien format réseau : conversion des coordonnées/vitesses non validée pour le coaching. Les compteurs restent lisibles, mais aucun appel IA gameplay n'est autorisé pour ce replay.".into());
    }
    player::validate_target(&metadata.players, target)?;
    if metadata.players.len() > 8 {
        return Err(
            "Gameplay limité aux parties comportant au plus huit joueurs enregistrés.".into(),
        );
    }
    if metadata
        .players
        .iter()
        .filter(|p| p.name == target.name && p.team == target.team)
        .count()
        != 1
    {
        return Err(
            "Association réseau ambiguë pour ce joueur. Aucun fallback sur un autre joueur.".into(),
        );
    }
    let frames = &replay
        .network_frames
        .as_ref()
        .ok_or_else(|| "Aucune frame gameplay décodée.".to_string())?
        .frames;
    if frames.is_empty() || frames.len() > MAX_FRAMES {
        return Err("Nombre de frames gameplay vide ou supérieur à 100 000.".into());
    }
    let origin = f64::from(frames[0].time);
    let end = f64::from(frames.last().unwrap().time);
    if !origin.is_finite() || !end.is_finite() || end - origin <= 0.0 || end - origin > MAX_SECONDS
    {
        return Err("Chronologie gameplay invalide ou supérieure à 30 minutes.".into());
    }
    let standard = replay.game_type == "TAGame.Replay_Soccar_TA"
        && metadata.map_name.as_deref().is_some_and(|map| {
            [
                "Stadium",
                "stadium",
                "EuroStadium",
                "TrainStation",
                "DFH",
                "Utopia",
                "UrbanCentral",
                "Wasteland",
                "NeoTokyo",
                "Park",
                "Farm",
                "Beach",
                "AquaDome",
                "CHN",
            ]
            .iter()
            .any(|prefix| map.starts_with(prefix))
        });
    let interval = ((end - origin) / 600.0).max(1.0);
    let mut state = State::default();
    let mut aggregates = Aggregates::default();
    let mut active_seconds = 0.0;
    let mut timeline = Vec::new();
    let mut evidence = Vec::new();
    let mut sequences = Vec::new();
    let mut ring = std::collections::VecDeque::new();
    let mut next_sample = origin;
    let mut next_dense = origin;
    let mut dense_until = 0.0;
    let mut dense_limited = false;
    let mut runs: [Run; 5] = std::array::from_fn(|_| Run::default());
    let mut prev_time = origin;
    let mut missing_intervals = 0.0;
    let mut high_water: [Option<i32>; 4] = [None; 4];
    for (i, frame) in frames.iter().enumerate() {
        let time = f64::from(frame.time);
        if !time.is_finite() || time < prev_time {
            return Err("Frames non chronologiques : analyse interrompue.".into());
        }
        // Integrate the previous reconstructed state over its actual interval, not by frame count.
        let dt = time - prev_time;
        if dt > 0.0 && dt <= 0.5 && state.phase.as_deref() == Some("Active") {
            let previous = state.sample(prev_time, origin, metadata);
            active_seconds += dt;
            aggregates.add(&previous, dt, metadata, target, standard);
            let car = previous.cars.iter().find(|c| c.player == target.index);
            let conditions = [
                aggregates.spatial_conditions[0],
                aggregates.spatial_conditions[1],
                aggregates.spatial_conditions[2],
                car.is_some_and(|c| {
                    c.boosting == Some(true)
                        && c.v.is_some_and(|v| {
                            f64::from(v[0])
                                .hypot(f64::from(v[1]))
                                .hypot(f64::from(v[2]))
                                >= 2200.0
                        })
                }),
                car.is_some_and(|c| c.boost.is_some_and(|b| b < 1.0)),
            ];
            let labels = [
                ("shared_ball_zone","Le joueur et un coéquipier sont simultanément à moins de 700 uu du ballon et à moins de 900 uu l'un de l'autre pendant ≥ 1 s. Signal spatial, pas une preuve de double commit."),
                ("last_back_ahead_of_ball","Le joueur est le coéquipier le plus reculé selon Y mais se trouve > 300 uu devant le ballon dans sa moitié défensive pendant ≥ 1 s. Signal de couverture à examiner, pas une faute automatique."),
                ("tight_teammate_spacing","Distance au coéquipier le plus proche < 500 uu pendant ≥ 1 s. Situation de proximité, pas une mauvaise rotation prouvée."),
                ("boost_at_supersonic","Boost activé avec vitesse ≥ 2 200 uu/s pendant ≥ 1 s. Examiner l'accélération, le virage et la suite de l'action avant de parler de gaspillage."),
                ("empty_boost","Boost répliqué < 1/100 pendant ≥ 1 s. Valeur maintenue entre mises à jour ; absence de boost seule n'est pas une erreur.")
            ];
            for ((run, condition), (kind, facts)) in runs.iter_mut().zip(conditions).zip(labels) {
                run.step(condition, &previous, dt, kind, facts, &mut evidence);
            }
        } else {
            if dt > 0.5 {
                missing_intervals += dt;
            }
            for run in &mut runs {
                *run = Run::default();
            }
        }
        state.apply(frame, replay);
        let sample = state.sample(time, origin, metadata);
        if time >= next_sample || i + 1 == frames.len() {
            timeline.push(sample.clone());
            next_sample = time + interval;
        }
        if time >= next_dense {
            ring.push_back(sample.clone());
            while ring.front().is_some_and(|s| s.time < sample.time - 8.0) {
                ring.pop_front();
            }
            if sample.time <= dense_until && sequences.len() < 1200 {
                sequences.push(sample.clone());
            } else if sample.time <= dense_until {
                dense_limited = true;
            }
            next_dense = time + 0.25;
        }
        let before = evidence.len();
        goal_evidence(replay, i, &sample, target, &mut evidence);
        let pris: Vec<_> = state
            .actors
            .values()
            .filter(|car| {
                car.kind == Kind::Car && state.player_index(car, metadata) == Some(target.index)
            })
            .filter_map(|car| car.pri.and_then(|id| state.actors.get(&id)))
            .collect();
        if pris.len() == 1 {
            for (index, value) in pris[0].counters.iter().enumerate() {
                if let Some(value) = value {
                    if let Some(previous) = high_water[index] {
                        if *value > previous
                            && state.phase.as_deref() == Some("Active")
                            && evidence.len() < MAX_EVIDENCE - 20
                        {
                            let (kind, label) = [
                                ("shot_counter_increase", "tirs"),
                                ("save_counter_increase", "arrêts"),
                                ("goal_counter_increase", "buts"),
                                ("demolition_counter_increase", "démolitions"),
                            ][index];
                            evidence.push(Evidence {id:format!("E{}",evidence.len()+1),time:sample.time,end_time:sample.time,kind:kind.into(),facts:format!("Le compteur réseau {label} du joueur cible passe de {previous} à {value}. Timestamp de réplication, pas de contact physique exact ; interpréter avec les positions précédentes et suivantes."),heuristic:false,context:sample.clone()});
                        }
                    }
                    high_water[index] =
                        Some(high_water[index].map_or(*value, |previous| previous.max(*value)));
                }
            }
        }
        if evidence.len() > before {
            // Goals are prioritized over heuristic signals; keep 8 s pre and 3 s post at ~4 Hz.
            if sequences.len() + ring.len() < 1200 {
                sequences.extend(ring.iter().cloned());
                dense_until = sample.time + 3.0;
            } else {
                dense_limited = true;
            }
        }
        prev_time = time;
    }
    if aggregates.observed < 5.0 {
        return Err("Moins de cinq secondes de gameplay rattachées au joueur choisi. Aucun appel IA ne sera lancé.".into());
    }
    sequences.sort_by(|a, b| a.time.total_cmp(&b.time));
    sequences.dedup_by(|a, b| a.time == b.time);
    let coverage = if active_seconds > 0.0 {
        100.0 * aggregates.observed / active_seconds
    } else {
        0.0
    };
    let spatial = if active_seconds > 0.0 {
        100.0 * aggregates.spatial / active_seconds
    } else {
        0.0
    };
    let mut warnings = vec![
        "Analyse de l'enregistrement disponible, pas une garantie de match complet. Timestamps depuis la première frame ; clock indique le chronomètre de jeu quand connu.".into(),
        "Chronologie échantillonnée sur toute la durée ; agrégats calculés sur toutes les frames actives observables. Les mécaniques entre échantillons ne sont pas entièrement visibles.".into(),
        "Boost répliqué maintenu entre mises à jour : métriques de réservoir approximatives, sans reconstruction calibrée de consommation/pads.".into(),
        "Les signaux de placement sont des heuristiques géométriques, pas des erreurs tactiques certifiées. Aucun rang ni percentile déduit.".into(),
        "Touches individuelles, pickups grands/petits, possession, xG et qualité mécanique ne sont pas reconstruits dans cette version.".into(),
    ];
    if missing_intervals > 0.0 {
        warnings.push(format!(
            "{} s d'intervalles réseau > 0,5 s exclus des agrégats.",
            rounded(missing_intervals)
        ));
    }
    if evidence.len() >= MAX_EVIDENCE - 20 || evidence.iter().filter(|e| e.heuristic).count() >= 60
    {
        warnings.push("Nombre de signaux plafonné ; les agrégats et la chronologie conservent toute la durée disponible.".into());
    }
    if dense_limited || sequences.len() >= 1200 {
        warnings.push("Les séquences denses sont plafonnées à 1 200 échantillons ; utiliser la chronologie globale pour les autres passages.".into());
    }
    if !standard {
        warnings.push("Carte ou mode non validé comme Soccar standard : métriques directionnelles et note désactivées.".into());
    }
    if coverage < 90.0 || spatial < 70.0 {
        warnings.push("Couverture spatiale insuffisante pour une note globale ou des conclusions de rotation fortes.".into());
    }
    let goals = evidence
        .iter()
        .filter(|e| e.kind.ends_with("_goal"))
        .count();
    let total_goals = metadata
        .blue_score
        .zip(metadata.orange_score)
        .map(|(a, b)| (a + b) as usize);
    if total_goals.is_some_and(|count| count != goals) {
        warnings.push("Les buts présents dans la chronologie ne couvrent pas tous les buts du score d'en-tête. Ne pas confondre score final et séquences observées.".into());
    }
    let quality = Quality {
        decoded_frames: frames.len(),
        recording_seconds: rounded(end - origin),
        active_seconds: rounded(active_seconds),
        target_observed_seconds: rounded(aggregates.observed),
        spatial_observed_seconds: rounded(aggregates.spatial),
        coverage_percent: rounded(coverage),
        complete_spatial_percent: rounded(spatial),
        timeline_interval_seconds: rounded(interval),
        timeline_samples: timeline.len(),
        standard_soccar: standard,
        can_assess: standard && coverage >= 90.0 && spatial >= 70.0 && aggregates.observed >= 60.0,
        warnings,
    };
    Ok(GameplayDossier {
        version: 1,
        target: target.index,
        quality,
        metrics: aggregates.metrics(),
        evidence,
        timeline,
        key_sequences: sequences,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn weighted_means_use_duration_not_number_of_frames() {
        let mut metric = Weighted::default();
        metric.add(1000.0, 0.1);
        metric.add(2000.0, 0.9);
        assert_eq!(metric.mean(), Some(1900.0));
        assert_eq!(Weighted::default().mean(), None);
    }
    #[test]
    fn boost_scale_and_actor_classification_are_explicit() {
        assert_eq!(classify("Archetypes.Teams.Team0"), Kind::Team(0));
        assert!(classify("Archetypes.Car.Car_Default") == Kind::Car);
        assert_eq!(rounded(128.0 * 100.0 / 255.0), 50.2);
    }
    #[test]
    fn signals_require_sustained_observation_and_reset_after_gap() {
        let sample = Snapshot {
            time: 1.0,
            clock: Some(299),
            phase: "Active".into(),
            ball: None,
            ball_velocity: None,
            cars: vec![],
        };
        let mut run = Run::default();
        let mut evidence = vec![];
        run.step(true, &sample, 0.6, "signal", "facts", &mut evidence);
        assert!(evidence.is_empty());
        run.step(false, &sample, 0.1, "signal", "facts", &mut evidence);
        run.step(true, &sample, 0.6, "signal", "facts", &mut evidence);
        assert!(evidence.is_empty());
        run.step(true, &sample, 0.5, "signal", "facts", &mut evidence);
        assert_eq!(evidence.len(), 1);
        assert!(evidence[0].heuristic);
    }
    #[test]
    fn missing_teammates_do_not_create_a_last_defender_or_rotation_signal() {
        let metadata = metadata::parse_bytes(&metadata::tests::minimal_replay()).unwrap();
        let mut metadata = metadata;
        metadata.players = vec![
            metadata::ReplayPlayer {
                name: "Target".into(),
                team: Some(0),
                is_bot: false,
                score: None,
                goals: None,
                assists: None,
                saves: None,
                shots: None,
            },
            metadata::ReplayPlayer {
                name: "Mate".into(),
                team: Some(0),
                is_bot: false,
                score: None,
                goals: None,
                assists: None,
                saves: None,
                shots: None,
            },
        ];
        let target = PlayerTarget {
            index: 0,
            name: "Target".into(),
            team: Some(0),
        };
        let sample = Snapshot {
            time: 1.0,
            clock: Some(299),
            phase: "Active".into(),
            ball: Some([0, -3000, 100]),
            ball_velocity: None,
            cars: vec![CarSample {
                player: 0,
                p: [0, -1000, 17],
                v: None,
                boost: None,
                boosting: None,
                q: [0.0, 0.0, 0.0, 1.0],
            }],
        };
        let mut aggregates = Aggregates::default();
        aggregates.add(&sample, 1.0, &metadata, &target, true);
        assert!(aggregates.last_back.mean().is_none());
        assert_eq!(aggregates.spatial_conditions, [false; 3]);
        assert!(aggregates.boost.mean().is_none());
    }
    #[test]
    fn actor_reuse_drops_old_identity_and_position() {
        let replay = ParserBuilder::new(&metadata::tests::minimal_replay())
            .never_parse_network_data()
            .parse()
            .unwrap();
        let mut state = State::default();
        state.actors.insert(
            42,
            Actor {
                name: Some("Old identity".into()),
                kind: Kind::Car,
                boost: Some(99.0),
                ..Actor::default()
            },
        );
        let frame = boxcars::Frame {
            time: 1.0,
            delta: 0.1,
            deleted_actors: vec![boxcars::ActorId(42)],
            new_actors: vec![boxcars::NewActor {
                actor_id: boxcars::ActorId(42),
                name_id: None,
                object_id: boxcars::ObjectId(0),
                initial_trajectory: boxcars::Trajectory {
                    location: None,
                    rotation: None,
                },
            }],
            updated_actors: vec![],
        };
        state.apply(&frame, &replay);
        assert!(state.actors[&42].name.is_none());
        assert!(state.actors[&42].body.is_none());
        assert!(state.actors[&42].boost.is_none());
    }
}
