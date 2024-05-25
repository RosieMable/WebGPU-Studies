import vertFrag from '../shaders/GameLifeShader.wgsl.js'
import compute from '../shaders/GLCompute.wgsl.js'

//Module type allows to use top-level awaits    
const canvas = document.querySelector("canvas");

const GRID_SIZE = 64;
const UPDATE_INTERVAL = 200; //update every 200ms
const WORKGROUP_SIZE = 8;

//WebGPU Code ----
if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browers.");
}

//Get Adapter -> Look at the GPU infos
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error("No appropriate GPU hardware found.");
}

//GPU device => Logical interface to interact with the GPU
const device = await adapter.requestDevice();

//Configure Canvas to use device created so it can show something
const context = canvas.getContext("webgpu");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device: device,
    format: canvasFormat,
});


//Game of Life 
//Square with colored cells for active ones and clear ones for the rest
//Need to create vertices for the square containing the cells
const vertices = new Float32Array([
    //   X,    Y,
    -0.8, -0.8,
    0.8, -0.8,
    0.8, 0.8,

    -0.8, -0.8,
    0.8, 0.8,
    -0.8, 0.8,
]);

const vertexBuffer = device.createBuffer({
    label: "Cell vertices", //Label for debugging purposes
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

//Copy vertices data into GPU buffer
device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/0, vertices);

const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = device.createBuffer({
    label: "Grid Uniforms",
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

//Array to store cell state data
const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

//Storage buffers instead of uniform buffers since storage buffs can be read and written to compute shaders and red in vertex shaders
//Storage buffer to hold the cell state
const cellStateStorage = [device.createBuffer({
    label: "Cell State A",
    size: cellStateArray.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
}),
device.createBuffer({
    label: "Cell State B",
    size: cellStateArray.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
})
];

//Mark every third cell of the grid as active
for(let i = 0; i < cellStateArray.length; ++i){
    cellStateArray[i] = Math.random() > 0.6 ? 1 :0;
}
device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

// Mark every other cell of the second grid as active.
for (let i = 0; i < cellStateArray.length; i++) {
    cellStateArray[i] = i % 2;
  }
  device.queue.writeBuffer(cellStateStorage[1], 0, cellStateArray);

//Define vertex layout
const vertexBufferLayout = {
    arrayStride: 8, //Number of bytes the GPU needs to skip forward in the buffer, when looking for next vertex
    attributes: [{ //Individual pieces of information inside each vertex
        format: "float32x2",
        offset: 0, //How many bytes into the vextes this particual attribute starts
        shaderLocation: 0, //Position, see vertex Shader
    }],
};

//Create shader -> Use createShaderModule, which will return GPUShaderModule object with the compiled shader
const cellShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: vertFrag
});

//Create Compute shader that will process the simulation
const cellSimulationComputeShaderModule = device.createShaderModule({
    label: "Compute Simulation Game of Life",
    code: compute
});

//Create bind group layout and pipeline layout
const bindGroupLayout = device.createBindGroupLayout({
    label: "Cell Bind Group Layout",
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX  | GPUShaderStage.FRAGMENT| GPUShaderStage.COMPUTE,
            buffer: {} //Grid Uniform buffer
        }, 
        {
            binding: 1,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
            buffer: {type: "read-only-storage"} //CellStateIn -> input buffer
        }, 
        {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {type: "storage"} 
        }
]
});

//To connect the uniform created in the shader and the buffer created above, there is the need to create a bind group and set it
//A bind group is a collection of resources that you want to make accessible to both the program and shader at the same type
const bindGroups = [device.createBindGroup({ //Returns GPUBindGroup, opaque and immutable handle
    label: "Cell Renderer Bind Group A",
    layout: bindGroupLayout, //Can used layout of the pipeline because it has the attribute "auto", which creates automatically bind groups layouts, it is 0 because in shader is @group(0)
    entries: [{
        binding: 0, //Corresponds to @binding()
        resource: {buffer: uniformBuffer}
    },
    { //resource that is exposed to the variable at the specified binding index
        binding: 1,
        resource: {buffer: cellStateStorage[0]}
    },
    {
        binding: 2,
        resource: {buffer: cellStateStorage[1]}
    }
],
}),
device.createBindGroup({ //Returns GPUBindGroup, opaque and immutable handle
    label: "Cell Renderer Bind Group B",
    layout: bindGroupLayout, //Can used layout of the pipeline because it has the attribute "auto", which creates automatically bind groups layouts, it is 0 because in shader is @group(0)
    entries: [{
        binding: 0, //Corresponds to @binding()
        resource: {buffer: uniformBuffer}
    },
    { //resource that is exposed to the variable at the specified binding index
        binding: 1,
        resource: {buffer: cellStateStorage[1]}
    },
    {
        binding: 2,
        resource: {buffer: cellStateStorage[0]}
    }
],
})
];

//Create Render Pipeline Layout
const renderPipelineLayout = device.createPipelineLayout({
    label: "Cell Pipeline Layout",
    bindGroupLayouts: [bindGroupLayout],
});

//Create GPURenderPipeline
const cellGPURenderPipeline = device.createRenderPipeline({
    label: "Cell GPU Render Pipeline",      //Label: Name for debuggine purposes
    layout: renderPipelineLayout,                         //Layout: Describes what types of inputes (other than vertex buffers) the pipeline needs
    vertex: {                               //Vertex: Vertex Stage definition
        module: cellShaderModule,           //Module: Points to a GPUShaderModule object that contains the desired vertex shader
        entryPoint: "vertexMain",           //EntryPoint: Name of the funtion in the shader code that will be called for every vertex
        buffers: [vertexBufferLayout]       //Buffers: Array of GPUVertexBufferLayout objects that describe how data is packed in the vertex buffers
    },
    fragment: {                             //Fragment: Fragment Stage definition
        module: cellShaderModule,           //Module: Points to a GPUShaderModule object that contains the desired fragment shader
        entryPoint: "fragmentMain",         
        targets: [{                        //Targets: Array of dictionaries giving details of the color attachments that the pipeline outputs to
            format: canvasFormat           //These details need to match the textures given in colorAttachments of any render passes that this pipeline is used with
        }]
    }
});

//Create compute pipeline to update game state
const computeSimulationPipeline = device.createComputePipeline({
    label: "Compute Simulation Pipeline",
    layout: renderPipelineLayout,
    compute: {
        module: cellSimulationComputeShaderModule,
        entryPoint: "computeMain",
    }
});

let step = 0; //simulation tracker

function UpdateGrid(){

//Create GPUCommandEncoder which provides an interface for recording GPU commands
const encoder = device.createCommandEncoder();

const computePass= encoder.beginComputePass();

computePass.setPipeline(computeSimulationPipeline);
computePass.setBindGroup(0, bindGroups[step % 2]);

const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
computePass.dispatchWorkgroups(workgroupCount, workgroupCount);

computePass.end();

//step count between the passes, so that the output buffer of the compute pipeline becomes the input buffer for the render pipeline
step++;

//Create a renderPass
const pass = encoder.beginRenderPass({
    colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        clearValue: { r: 0.1, g: 0.3, b: 0.4, a: 0.4 },
        storeOp: "store",
    }],
});

pass.setPipeline(cellGPURenderPipeline);
pass.setVertexBuffer(0, vertexBuffer); //0 because it is the 0th element of the GPURenderPipeline in vertex.buffers
pass.setBindGroup(0, bindGroups[step % 2]);
pass.draw(vertices.length / 2,  GRID_SIZE * GRID_SIZE);
pass.end();

//To create a command buffer for the gpu to execute, need to call finish on the encoder
const commandBuffer = encoder.finish();
device.queue.submit([commandBuffer]);

}

setInterval(UpdateGrid, UPDATE_INTERVAL);

