fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .ok_or("Usage: inspect_replays <folder>")?;
    let files = octalume_lib::replays::scan_directory(&path)?;
    println!("{}", serde_json::to_string_pretty(&files)?);
    Ok(())
}
