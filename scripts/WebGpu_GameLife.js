import code from '../shaders/GameLifeShader.wgsl.js'

//Module type allows to use top-level awaits    
const canvas = document.querySelector("canvas");

//WebGPU Code ----
if(!navigator.gpu){
    throw new Error("WebGPU not supported on this browers.");
}

//Get Adapter -> Look at the GPU infos
const adapter = await navigator.gpu.requestAdapter();
if(!adapter){
    throw new Error("No appropriate GPU hardware found.");
}

//GPU device => Logical interface to interact with the GPU
const device = await adapter.requestDevice();

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

//Configure Canvas to use device created so it can show something
const context = canvas.getContext("webgpu");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device: device,
    format: canvasFormat,
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
pass.end();

//To create a command buffer for the gpu to execute, need to call finish on the encoder
const commandBuffer = encoder.finish();
device.queue.submit([commandBuffer]);

