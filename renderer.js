
function compileShader(gl, id, type) {
  let code = document.getElementById(id).firstChild.nodeValue;
  let shader = gl.createShader(type);

  gl.shaderSource(shader, code);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log(`Error compiling ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader:`);
    console.log(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function buildShaderProgram(gl, shaderInfo) {
  let program = gl.createProgram();

  shaderInfo.forEach(function(desc) {
    let shader = this.compileShader(gl, desc.id, desc.type);

    if (shader) {
      gl.attachShader(program, shader);
    }
  });

  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log("Error linking shader program:");
    console.log(gl.getProgramInfoLog(program));
  }

  return program;
}

function Renderer (canvas, circleArray) {

  let gl = null;
  let glCanvas = canvas;
  let circles = circleArray;
  let radius = 5;

  // Aspect ratio and coordinate system details
  let aspectRatio;
  let currentScale = [1.0, 1.0];

  // Vertex information
  let vertexArray;
  let vertexBuffer;
  let vertexNumComponents;
  let vertexCount;

  // Rendering data shared with the scalers.
  let uScalingFactor;
  let uGlobalColor;
  let uTranslationVector;
  let aVertexPosition;

  // Animation timing
  let previousTime = 0.0;
  let degreesPerSecond = 60.0;


  let output = {

    init: function (circleRadius) {
      radius = circleRadius;
      
      gl = glCanvas.getContext("webgl");

      const shaderSet = [
        {
          type: gl.VERTEX_SHADER,
          id: "vertex-shader"
        },
        {
          type: gl.FRAGMENT_SHADER,
          id: "fragment-shader"
        }
      ];

      shaderProgram = buildShaderProgram(gl, shaderSet);

      aspectRatio = glCanvas.width/glCanvas.height;
      currentScale = [1/glCanvas.width, 1/glCanvas.height];

      // Vertex array for circle
      // We will use the TRIANGLE_FAN primitive (Create triangles by using the first vertex in the list, and pairs of successive vertices.)
      const totalPoints = 8;
      vertexArray = new Float32Array(totalPoints*2 + 4);
      vertexArray[0] = 0;
      vertexArray[1] = 0;
      for (let i = 0; i <= totalPoints; i++) {
         const angle = 2 * Math.PI * i / totalPoints;
         const x = radius * Math.cos(angle);
         const y = radius * Math.sin(angle);
         vertexArray[(i+1)*2+0] = x;
         vertexArray[(i+1)*2+1] = y;
      }

      vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);

      vertexNumComponents = 2;
      vertexCount = vertexArray.length/vertexNumComponents;
      
      gl.useProgram(shaderProgram); //Program isn't changing, so we can do this just once

      uScalingFactor = gl.getUniformLocation(shaderProgram, "uScalingFactor");
      uGlobalColor = gl.getUniformLocation(shaderProgram, "uGlobalColor");
      uTranslationVector = gl.getUniformLocation(shaderProgram, "uTranslationVector");

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

      aVertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition"); //get the vertex position attribute's index

      gl.enableVertexAttribArray(aVertexPosition); //enable the position attribute so it can be used by the vertex shader
      gl.vertexAttribPointer(aVertexPosition, vertexNumComponents, gl.FLOAT, false, 0, 0); //bind the vertex buffer to the aVertexPosition
      
      gl.uniform2fv(uScalingFactor, currentScale);
    },

    drawScene: function () {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.clearColor(1.0, 1.0, 1.0, 1.0); //white background
      gl.clear(gl.COLOR_BUFFER_BIT);

      for (let i = 0; i < circles.length; i++) {
        if (circles[i].visible) {
          gl.uniform4fv(uGlobalColor, circles[i].color);
          gl.uniform2fv(uTranslationVector, circles[i].translation);

          gl.drawArrays(gl.TRIANGLE_FAN, 0, vertexCount); //draw the shape
        }
      }
    }
  }
  
  return output;
}