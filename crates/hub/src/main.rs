//! Suit/rover hub: bridges satellite and glove, keeps a larger tile cache.
use nasamars_hub::Hub;

fn main() {
    // Glove downlink queue is filled as frames arrive from the satellite.
    let hub: Hub<32> = Hub::new();
    println!("nasamars-hub: bridge satellite <-> glove (glove queue: {} frames)", hub.glove.len());
}
