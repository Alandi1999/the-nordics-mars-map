// Command earth is a placeholder for the Earth-side ingest. It is not implemented yet:
// it only prints the layer constants shared with the Rust core.
package main

import (
	"fmt"

	"nasamars/earth/layers"
)

func main() {
	fmt.Printf("nasamars-earth: tile %dx%d cells at %d m\n", layers.TileSide, layers.TileSide, layers.CellMeters)
}
