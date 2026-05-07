// Hand-written declaration for the bundled Romania counties topology.
// The .js file is a single default-exported TopoJSON object; we keep it as
// `any` because TopoJSON's nested arc/objects shape is not what we type
// against (topojson-client narrows it for us at the call site).
declare const countiesTopo: any;
export default countiesTopo;
