// Command earth ingests DONKI/MOLA/HiRISE data and precomputes layers.
package main

import (
	"fmt"

	"nasamars/earth/layers"
)

func main() {
	fmt.Printf("nasamars-earth: tile %dx%d cells at %d m\n", layers.TileSide, layers.TileSide, layers.CellMeters)
}
