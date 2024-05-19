import code from '../shaders/GameLifeShader.wgsl.js'

//Module type allows to use top-level awaits    
const canvas = document.querySelector("canvas");

const GRID_SIZE = 64;

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
    code
})

//Create GPURenderPipeline

const cellGPURenderPipeline = device.createRenderPipeline({
    label: "Cell GPU Render Pipeline",      //Label: Name for debuggine purposes
    layout: "auto",                         //Layout: Describes what types of inputes (other than vertex buffers) the pipeline needs
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

//To connect the uniform created in the shader and the buffer created above, there is the need to create a bind group and set it
//A bind group is a collection of resources that you want to make accessible to both the program and shader at the same type
const bindGroup = device.createBindGroup({ //Returns GPUBindGroup, opaque and immutable handle
    label: "Cell Renderer Bind Group",
    layout: cellGPURenderPipeline.getBindGroupLayout(0), //Can used layout of the pipeline because it has the attribute "auto", which creates automatically bind groups layouts, it is 0 because in shader is @group(0)
    entries: [{
        binding: 0, //Corresponds to @binding()
        resource: {buffer: uniformBuffer} //resource that is exposed to the variable at the specified binding index
    }],
});


//Once the canvas has been configured, clear the canvas with a solid colour
//Create GPUCommandEncoder which provides an interface for recording GPU commands
const encoder = device.createCommandEncoder();

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
pass.setBindGroup(0, bindGroup);
pass.draw(vertices.length / 2,  GRID_SIZE * GRID_SIZE);
pass.end();

//To create a command buffer for the gpu to execute, need to call finish on the encoder
const commandBuffer = encoder.finish();
device.queue.submit([commandBuffer]);

