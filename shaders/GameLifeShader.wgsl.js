export default /* wgsl */ `


//Structs in WGSL => Named object types that contain one or more named properties
struct VertexInput{
    @location(0) pos : vec2f,
    @builtin(instance_index) instance : u32,
};

struct VertexOutput{
    @builtin(position) pos : vec4f,
    @location(0) cell: vec2f,
};

struct FragOutput{
    @location(0) color: vec4f,
};

//Defines uniform that is 2D float vector that matches the uniformArray 
@group(0) @binding(0) var<uniform> grid: vec2f;

//@builtin(position) attribute to indicate we are returning the final position of the vertex being processed in clipspace
//@location(0) attribute to indicate the data to use from the buffer created (0 because of what is in vertexBufferLayout)
@vertex 
fn vertexMain(input: VertexInput) -> 
VertexOutput {

    //let in WGSL == const in JavaScript => Variable that won't change after assignment

    let i = f32(input.instance); //Casting type to floats because pos uses floating numbers
    //Compute the cell coordinate from the instance_index by usingthe modulo op and for each Y value / by grid width => floor() function
    let cell = vec2f(i % grid.x, floor(i / grid.x));
    let cellOffset = cell / grid * 2; //2 is used to go from coordinate -1 to +1
    //Subtract 1 after dividing by grid size because canvas' coordinate system has BOTTOM LEFT == (-1, -1) and CENTER == (0, 0)
    let gridPos = (input.pos + 1) / grid - 1 + cellOffset;

    var output : VertexOutput;
    output.pos = vec4f(gridPos, 0, 1);
    output.cell = cell;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) ->FragOutput {

    var outputColor: FragOutput;

    let c = input.cell/grid;
    outputColor.color = vec4f(c, 1.5-c.x, 1);
    return outputColor;
}
`