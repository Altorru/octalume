use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Default)]
pub struct AnalysisGate(AtomicBool);
pub struct Permit<'a>(&'a AtomicBool);

impl AnalysisGate {
    pub fn acquire(&self) -> Result<Permit<'_>, String> {
        self.0
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| {
                "Une analyse est déjà en cours. Attends sa fin avant de réessayer.".to_string()
            })?;
        Ok(Permit(&self.0))
    }
}
impl Drop for Permit<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn permits_only_one_analysis_and_releases_on_drop() {
        let gate = AnalysisGate::default();
        let permit = gate.acquire().unwrap();
        assert!(gate.acquire().is_err());
        drop(permit);
        assert!(gate.acquire().is_ok());
    }
}
