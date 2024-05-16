export default /* wgsl */ `

//Defines uniform that is 2D float vector that matches the uniformArray 
@group(0) @binding(0) var<uniform> grid: vec2f;

//@builtin(position) attribute to indicate we are returning the final position of the vertex being processed in clipspace
//@location(0) attribute to indicate the data to use from the buffer created (0 because of what is in vertexBufferLayout)
@vertex 
fn vertexMain(@location(0) pos: vec2f) -> 
@builtin(position) vec4f{

    //let in WGSL == const in JavaScript => Variable that won't change after assignment

    let cell = vec2f(1, 1);
    let cellOffset = cell / grid * 2; //2 is used to go from coordinate -1 to +1
    //Subtract 1 after dividing by grid size because canvas' coordinate system has BOTTOM LEFT == (-1, -1) and CENTER == (0, 0)
    let gridPos = (pos + 1) / grid - 1 + cellOffset;

    return vec4f(gridPos, 0, 1); // (X, Y, Z, W)
}

@fragment
fn fragmentMain() ->@location(0) vec4f {
    return vec4f(1, 0, 0, 1);
}
`