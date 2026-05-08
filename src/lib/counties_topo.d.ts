// Hand-written declaration for the bundled Romania counties topology.
// The .js file is a single default-exported TopoJSON object.
import type { Topology, GeometryCollection } from "topojson-specification";

interface CountyProperties {
  name: string;
}

interface CountiesTopology extends Topology {
  objects: {
    "romania.counties": GeometryCollection<CountyProperties>;
  };
}

declare const countiesTopo: CountiesTopology;
export default countiesTopo;
