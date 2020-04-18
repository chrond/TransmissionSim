
// The task scheduler for the main game loop
var fps = 60;
var gameLoopInterval = Math.floor(1000/fps);
var taskScheduler;

var balls = []; // array for ball objects
var critBalls = []; // array for balls in critical condition (waiting for icu)
var icuBalls = []; // array for balls in intensive care (in icu)

var ball_radius = 4;

var color_initial = [.353,.627,1.0,1.0];
var color_infected = [.706,.392,.235,1.0];
var color_recovered = [.588,.784,.510,1.0];
var color_critical = [1.0,0,0,1.0];
var color_icu = [1.0,0,.784,1.0];
var color_dead = [.235,.118,.235,1.0];

var simInProgress = false;
var startPauseFlag = null;
var simEndTimerId = null;

// Contagion
var recoveryTime = 8;
var criticalCaseRate = 0.15; // chance for each infection to become a critical case
var criticalDeathRate = 0.90; // death rate for critical cases that do NOT get intensive care

// Hospital
var icuCapacity = 1; // 0 to 20
var icuDeathRate = 0.05; // death rate for critical cases that get intensive care

// Behavior - Reduced Interaction
var RI_PopPercent = 0; //0 to 100
var RI_Total = 0;
var RI_SpeedReduction = 80; //30 to 90

// Stats
var totalPopulation = 0;
var healthyCount = 0;
var infectedCount = 0;
var recoveredCount = 0;
var deathCount = 0;
var criticalCount = 0;
var icuCount = 0;
var chartDataTimerId = null;
var chart;

// Stat DOM elements
var healthyCountObj
var infectedCountObj
var recoveredCountObj
var deathCountObj
var criticalCountObj
var icuCountObj

//Input DOM elements
var recoveryTimeSelectorObj
var recoveryTimeLabelObj
var criticalCaseRateSelectorObj 
var criticalCaseRateLabelObj
var criticalDeathRateSelectorObj
var criticalDeathRateLabelObj
var icuCapacitySelectorObj
var icuCapacityLabelObj
var icuDeathRateSelectorObj
var icuDeathRateLabelObj
var popPercentSelectorObj
var popPercentLabelObj
var speedReductionSelectorObj
var speedReductionLabelObj

var drawAreaHeight
var drawAreaWidth

//Canvas and chart DOM elements
var canvas;
var canvasContext;
var chartSvg;

var renderer;

/////////////////////////////////////
//////////// Initialize /////////////
/////////////////////////////////////

// Do initialization when document loads
if (document.readyState === 'complete') {
  init();
}
else {
  window.onload = function() {
    init();
  }
}

function init() {
  // Initialize stat elements
  healthyCountObj = document.getElementById("healthyCount");
  infectedCountObj = document.getElementById("infectedCount");
  recoveredCountObj = document.getElementById("recoveredCount");
  deathCountObj = document.getElementById("deathCount");
  criticalCountObj = document.getElementById("criticalCount");
  icuCountObj = document.getElementById("icuCount");

  // Initialize input elements
  recoveryTimeSelectorObj = document.getElementById('recoveryTimeSelector');
  recoveryTimeSelectorObj.value = recoveryTime;
  recoveryTimeLabelObj = document.getElementById('recoveryTimeLabel');
  recoveryTimeLabelObj.innerHTML = recoveryTime;
  criticalCaseRateSelectorObj = document.getElementById('criticalCaseRateSelector');
  criticalCaseRateSelectorObj.value = criticalCaseRate;
  criticalCaseRateLabelObj = document.getElementById('criticalCaseRateLabel');
  criticalCaseRateLabelObj.innerHTML = criticalCaseRate;
  criticalDeathRateSelectorObj = document.getElementById('criticalDeathRateSelector');
  criticalDeathRateSelectorObj.value = criticalDeathRate;
  criticalDeathRateLabelObj = document.getElementById('criticalDeathRateLabel');
  criticalDeathRateLabelObj.innerHTML = criticalDeathRate;
  icuCapacitySelectorObj = document.getElementById('icuCapacitySelector');
  icuCapacitySelectorObj.value = icuCapacity;
  icuCapacityLabelObj = document.getElementById('icuCapacityLabel');
  icuCapacityLabelObj.innerHTML = icuCapacity;
  icuDeathRateSelectorObj = document.getElementById('icuDeathRateSelector');
  icuDeathRateSelectorObj.value = icuDeathRate;
  icuDeathRateLabelObj = document.getElementById('icuDeathRateLabel');
  icuDeathRateLabelObj.innerHTML = icuDeathRate;
  popPercentSelectorObj = document.getElementById('popPercentSelector');
  popPercentSelectorObj.value = RI_PopPercent;
  popPercentLabelObj = document.getElementById('popPercentLabel');
  popPercentLabelObj.innerHTML = RI_PopPercent;
  speedReductionSelectorObj = document.getElementById('speedReductionSelector');
  speedReductionSelectorObj.value = RI_SpeedReduction;
  speedReductionLabelObj = document.getElementById('speedReductionLabel');
  speedReductionLabelObj.innerHTML = RI_SpeedReduction;

  // Initialize the scheduler
  taskScheduler = new Scheduler(gameLoopInterval, CoreSimLoop);
  
  // Initialize canvas
  canvas = document.getElementById('drawArea');
  drawAreaWidth = canvas.clientWidth;
  drawAreaHeight = canvas.clientHeight;
  canvas.height = canvas.clientHeight;
  canvas.width = canvas.clientWidth;
  //canvasContext = canvas.getContext('2d', { alpha: false });
  
  // Clear canvas
  //canvasContext.fillStyle = 'white';
  //canvasContext.fillRect(0, 0, canvas.width, canvas.height);

  renderer = new Renderer(canvas, balls);
  //renderer.init(ball_radius);

  // Initialize Simulation
  InitializeBalls();

  // Initialize Chart
  chart = new Chart(MakeRgb(color_dead), MakeRgb(color_infected), MakeRgb(color_initial), MakeRgb(color_recovered));
  chartSvg = chart.Initialize('graphArea');
  chart.Reset();
}


/////////////////////////////////////
///////////// Core Loop /////////////
/////////////////////////////////////

function CoreSimLoop() {
  //let n1 = performance.now();
  
  ManageICU();
  for (let i = 0; i < balls.length; i++) {
    balls[i].Move();
    for (let j = i + 1; j < balls.length; j++) {
      ProcessCollision(i, j);
    }
  }

  //Draw to canvas
  //canvasContext.fillStyle = 'white';
  //canvasContext.fillRect(0, 0, canvas.width, canvas.height);

  //for (let i = 0; i < balls.length; i++) {
  //  balls[i].Draw();
  //}
  
  renderer.drawScene();
  
  //console.log(performance.now() - n1);
}

/////////////////////////////////////
//////////// Ball Object ////////////
/////////////////////////////////////

function Ball(areaHeight, areaWidth, id, x, y, state, angle, radius, speed, highRisk) {
  this.areaHeight = areaHeight;
  this.areaWidth = areaWidth;
  this.posX = x;
  this.posY = y;
  this.radius = radius;
  this.speed = speed;
  this.highRisk = highRisk; // will become critical if infected
  this.id = id; // id of ball
  this.angle = angle; // initial angle of movement in radians
  this.color = color_initial; //used by renderer
  this.infectionTimerId = null;
  this.deathTimerId = null;
  this.criticalTimerId = null;
  this.speedFactor = 1; // dynamically changing speed factor for interaction reduction
  this.critical = false;
  this.icu = false;
  this.visible = true; //used by renderer
  this.translation = [this.posX, this.posY]; //used by renderer

  if (!this.angle)
    this.angle = Math.PI / 7;
  if (!this.radius)
    this.radius = ball_radius;
  if (!this.state)
    this.state = "initial";

  // Angle is used only for initialization
  // Direction and speed together is velocity
  this.vx = Math.cos(this.angle) * this.speed; // velocity x
  this.vy = Math.sin(this.angle) * this.speed; // velocity y
  
  this.SetState = function (newState) {
    switch(newState) {
      case "initial":
        this.state = newState;
        this.color = color_initial;
        break;
      case "infected":
        this.state = newState;
        this.color = color_infected;
        IncrementInfected();
        break;
      case "recovered":
        this.state = newState;
        this.color = color_recovered;
        IncrementRecovered();
        break;
      case "dead":
        this.state = newState;
        this.color = color_dead;
        IncrementDeaths();
        break;
      case "buried":
        this.state = newState;
        this.visible = false;
        break;
      default:
        this.state = newState;
        this.color = color_initial;
    }

    // If infected, start recovery timer
    if (this.state == "infected") {
      this.infectionTimerId = taskScheduler.add(
        DoRecover,
        recoveryTime*1000,
        false, //run once
        this, //bind to this context
        [this] //pass this as an argument
      );
      
      // If high risk, start critical timer
      if (this.highRisk) {
        this.criticalTimerId = taskScheduler.add(
          DoCritical,
          recoveryTime*500,
          false, //run once
          this, //bind to this context
          [this] //pass this as an argument
        );
      }
    }
    
    // If dead, start death timer
    if (this.state == "dead") {
      this.deathTimerId = taskScheduler.add(
        DoDeath,
        500,
        false, //run once
        this, //bind to this context
        [this] //pass this as an argument
      );
    }
  }
  
  // Set the color based on state
  this.SetState(this.state);
  
  this.Draw = function () {
    if (this.state != "buried") {
      // Draw the circle
      //this.canvasContext.fillStyle = this.color;
      //this.canvasContext.beginPath();
      //this.canvasContext.arc(this.posX, this.posY, this.radius, 0, Math.PI*2, true);
      //this.canvasContext.fill();
    }
  }

  this.Move = function () {
    let factor = this.speedFactor;
    if (this.critical) factor = factor * 0.5;
    else if (this.icu) factor = factor * 0.3;
    else if (this.state === "dead") factor = factor * 0.2;
    
    this.posX += this.vx * factor;
    this.posY += this.vy * factor;

    this.CheckBounds();
    
    //Convert from canvas 2d coordinates to webgl coordinates
    this.translation = [this.posX * 2 - areaWidth, this.posY * -2 + areaHeight];
  }

  this.CheckBounds = function () {
    //Handle bounds collision
    if (this.posX >= areaWidth - this.radius) {
      this.posX = areaWidth - this.radius - 1;
      this.vx = -Math.abs(this.vx);
    }
    if ( this.posX <= this.radius) {
      this.posX = this.radius+1;
      this.vx = Math.abs(this.vx);
    }
    if (this.posY >= areaHeight - this.radius) {
      this.posY = areaHeight - this.radius - 1;
      this.vy = -Math.abs(this.vy);
    }
    if (this.posY <= this.radius) {
      this.posY = this.radius+1;
      this.vy = Math.abs(this.vy);
    }
  }

} //End Ball

/////////////////////////////////////
///////////// Collision /////////////
/////////////////////////////////////

function CheckCollision(ball1, ball2) {
  var absx = Math.abs(ball2.posX - ball1.posX);
  var absy = Math.abs(ball2.posY - ball1.posY);
  
  if (absx > ball_radius*2 || absy > ball_radius*2)
    return false;

  // find distance between two balls.
  var distance = (absx * absx) + (absy * absy);
  distance = Math.sqrt(distance);
  
  // check if distance is less than sum of two radius - if yes, collision
  if (distance < ball_radius*2) {
    return true;
  }
  
  return false;
}

function ProcessCollision(b1, b2) {
  if (b2 <= b1)
    return;
  if (b1 >= (balls.length-1) || b2 >= balls.length )
    return;

  ball1 = balls[b1];
  ball2 = balls[b2];
  
  if (ball1.state == "buried" || ball2.state == "buried")
    return;

  if ( CheckCollision(ball1, ball2) ) {
    if (ball1.state == "infected" && ball2.state == "initial") {
      ball2.SetState("infected");
    }
    else if (ball2.state == "infected" && ball1.state == "initial") {
      ball1.SetState("infected");
    }

    // calculate impulse vectors
    let impulseX1 = ball1.posX - ball2.posX;
    let impulseY1 = ball1.posY - ball2.posY;
    
    if (impulseX1 != 0 || impulseY1 != 0) {
      // normalize the impulse vectors
      let impulseMag1 = Math.sqrt(impulseX1*impulseX1 + impulseY1*impulseY1);
      impulseX1 = impulseX1/impulseMag1;
      impulseY1 = impulseY1/impulseMag1;
      
      // set new velocity
      ball1.vx = impulseX1 * ball1.speed;
      ball1.vy = impulseY1 * ball1.speed;
      
      // direction of ball 2 will be opposite of ball 1
      ball2.vx = -impulseX1 * ball2.speed;
      ball2.vy = -impulseY1 * ball2.speed;
    }

    // make sure balls are not overlapping
    let moveCount = 0
    while (CheckCollision(ball1, ball2) && moveCount < 100 && (ball1.speed > 0 || ball2.speed > 0)) {
      if (moveCount % 2 == 0)
        ball1.Move();
      else
        ball2.Move();
      moveCount++;
    }
  }
}

/////////////////////////////////////
///////// Utility Functions /////////
/////////////////////////////////////

function RgbToHex(rgbString) {
  let rgb = rgbString.split("(")[1].split(")")[0];
  rgb = rgb.split(",");

  var hex = rgb.map(function(x){       //For each array element
    x = parseInt(x).toString(16);      //Convert to a base16 string
    return (x.length==1) ? "0"+x : x;  //Add zero if we get only one character
  })

  hex = "0x"+hex.join("");
  return hex;
}

//utility function from https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function Shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function MakeRgb(colorArray) {
  if (colorArray && colorArray.length >= 3)
    return 'rgb(' + colorArray[0] * 255 + ',' + colorArray[1] * 255 + ',' + colorArray[2] * 255 + ')';
  else
    return 'rgb(0,0,0)';
}

/////////////////////////////////////
//////////// Init Balls /////////////
/////////////////////////////////////

function InitializeBalls() {
  // Clear existing timers
  taskScheduler.clear();
  
  for (let i = 0; i < balls.length; i++) {
    balls[i] = null;
  }
  
  // Empty the arrays
  balls.length = 0;
  critBalls.length = 0;
  icuBalls.length = 0;
  
  let po = document.getElementById('populationSelector');
  totalPopulation = po.options[po.selectedIndex].value;
  
  let so = document.getElementById('speedSelector');
  let speed = so.options[so.selectedIndex].value;

  if (totalPopulation > 1000)
    ball_radius = 2;
  else if (totalPopulation > 500)
    ball_radius = 3;
  else
    ball_radius = 4;

  renderer.init(ball_radius*2);

  // Determine initial ball locations
  let boundsArea = drawAreaWidth * drawAreaHeight;
  let ballSpace = boundsArea / totalPopulation;
  let ballLength = Math.sqrt(ballSpace);
  let ballCountX = 0, ballCountY = 0, areaCapacity = 0;
  do {
    ballCountX = Math.floor(drawAreaWidth / ballLength);
    ballCountY = Math.floor(drawAreaHeight / ballLength);
    areaCapacity = ballCountX * ballCountY;
    
    if (areaCapacity < totalPopulation) {
      ballLength--;
    }
  }
  while (areaCapacity < totalPopulation && ballLength > ball_radius*2 + 1);
  
  //Find out actual number of rows required
  ballCountY = Math.ceil(totalPopulation / ballCountX);

  // Expand height and width to fill the area
  let ballWidth = drawAreaWidth / ballCountX;
  let ballHeight = drawAreaHeight / ballCountY;

  // Add the balls
  let row = 0, col = 0;
  for (let i = 0; i < totalPopulation; i++) {
    let x = Math.floor(col*ballWidth + ballWidth/2);
    let y = Math.floor(row*ballHeight + ballHeight/2);
    
    let highRisk = Math.random() < criticalCaseRate;
    
    //Add ball
    balls.push(new Ball(drawAreaHeight, drawAreaWidth, 'n'+(i+1).toString(), x, y, "initial", Math.random()*2*Math.PI, ball_radius, speed, highRisk));
    
    if (col == ballCountX-1) {
      row++;
      col = 0;
    }
    else {
      col++;
    }
  }
  
  //Randomize array to prepare for interaction reduction
  Shuffle(balls);
}

/////////////////////////////////////
///////// Start Pause Stop //////////
/////////////////////////////////////

function StartSim() {
  if (simInProgress && startPauseFlag == null) { //Start from paused
    document.getElementById('startButton').disabled = true;
    
    startPauseFlag = 1;
    taskScheduler.start();
    
    //document.getElementById('startPause').disabled = false;
    document.getElementById('stopButton').disabled = false;
  }
  else if (!simInProgress) { //Start from stopped
    document.getElementById('startButton').disabled = true;
    document.getElementById('speedSelector').disabled = true;
    document.getElementById('populationSelector').disabled = true;
    document.getElementById('recoveryTimeSelector').disabled = true;
    document.getElementById('criticalCaseRateSelector').disabled = true;
    document.getElementById('criticalDeathRateSelector').disabled = true;
    simInProgress = true;
    
    //Create the balls
    InitializeBalls();
    
    //Update stats
    healthyCount = balls.length;
    infectedCount = 0;
    recoveredCount = 0;
    deathCount = 0;
    criticalCount = 0;
    icuCount = 0;
    healthyCountObj.innerHTML = healthyCount;
    infectedCountObj.innerHTML = infectedCount;
    recoveredCountObj.innerHTML = recoveredCount;
    deathCountObj.innerHTML = deathCount;
    criticalCountObj.innerHTML = criticalCount;
    icuCountObj.innerHTML = icuCount;
    chart.Reset();
    
    //Initialize interaction reduction
    RI_Total = 0;
    SetPopPercent();
    
    //Infect a ball
    balls[Math.floor(Math.random() * balls.length)].SetState("infected");
    
    chart.Update(deathCount, infectedCount, healthyCount, recoveredCount);
    chartDataTimerId = taskScheduler.add(UpdateChart, 1000, true);
    
    //Start the sim
    taskScheduler.start();
    
    //document.getElementById('startPause').disabled = false;
    document.getElementById('stopButton').disabled = false;
  }
}

function UpdateChart() {
  chart.Update(deathCount, infectedCount, healthyCount, recoveredCount);
}

function PauseSim() {
  if (simInProgress && startPauseFlag != null) {
    //document.getElementById('startPause').disabled = true;

    startPauseFlag = null;
    taskScheduler.stop();
    
    document.getElementById('startButton').disabled = false;
  }
}

function StopSim() {
  document.getElementById('stopButton').disabled = true;
  //document.getElementById('startPause').disabled = true;
  startPauseFlag = null;
  taskScheduler.stop();
  
  simInProgress = false;

  chart.Draw(totalPopulation);
  
  document.getElementById('startButton').disabled = false;
  document.getElementById('speedSelector').disabled = false;
  document.getElementById('populationSelector').disabled = false;
  document.getElementById('recoveryTimeSelector').disabled = false;
  document.getElementById('criticalCaseRateSelector').disabled = false;
  document.getElementById('criticalDeathRateSelector').disabled = false;
}

/////////////////////////////////////
//////////// ICU Logic //////////////
/////////////////////////////////////

function ManageICU() {
  while (icuBalls.length < icuCapacity && critBalls.length > 0) {
    let ball = critBalls[0];
    
    //when ball enters icu, stop the existing infectionTimer and create a new one for 40% the normal recovery time
    if (ball.infectionTimerId) {
      taskScheduler.remove(ball.infectionTimerId);
      ball.infectionTimer = taskScheduler.add(
        DoRecover,
        recoveryTime*400,
        false,
        ball,
        [ball]
      );
    }
    
    icuBalls.push(ball);
    critBalls.splice(0,1);
    ball.critical = false;
    ball.icu = true;
    
    ball.color = color_icu;
    d3.select("#" + ball.id).style("fill", ball.color);
    IncrementIcu();
  }
}

/////////////////////////////////////
///////// Ball Event Logic //////////
/////////////////////////////////////

// The callback function for the infection timer
function DoRecover(ball) {
  if (ball && ball.infectionTimerId) {
    
    // Remove from critical array
    if (ball.critical) {
      for (let i = 0; i < critBalls.length; i++) {
        if (critBalls[i] === ball) {
          critBalls.splice(i,1);
          DecrementCritical();
        }
      }
    }
    // Remove from icu array
    if (ball.icu) {
      for (let i = 0; i < icuBalls.length; i++) {
        if (icuBalls[i] === ball) {
          icuBalls.splice(i,1);
          DecrementIcu();
          DecrementCritical();
        }
      }
    }
    
    if (ball.highRisk && !ball.icu && Math.random() < criticalDeathRate) {
      ball.SetState("dead");
    }
    else if (ball.highRisk && Math.random() < icuDeathRate) {
      ball.SetState("dead");
    }
    else {
      ball.SetState("recovered");
    }
    
    if (ball.critical) ball.critical = false;
    if (ball.icu) ball.icu = false;
  }
}

// The callback function for the death timer
function DoDeath(ball) {
  if (ball && ball.deathTimerId) {
    ball.SetState("buried");
  }
}

// The callback function for the critical timer
function DoCritical(ball) {
  if (ball && ball.criticalTimerId) {
    critBalls.push(ball);
    ball.critical = true;
    //ball.speedFactor = ball.speedFactor * 0.3;
    ball.color = color_critical;
    IncrementCritical();
  }
}

/////////////////////////////////////
////////// Input Functions //////////
/////////////////////////////////////

function SetRecoveryTime() {
  recoveryTime = recoveryTimeSelectorObj.value;
  recoveryTimeLabel.innerHTML = recoveryTime;
}
function SetCriticalCaseRate() {
  criticalCaseRate = criticalCaseRateSelectorObj.value;
  criticalCaseRateLabelObj.innerHTML = criticalCaseRate;
}
function SetCriticalDeathRate() {
  criticalDeathRate = criticalDeathRateSelectorObj.value;
  criticalDeathRateLabelObj.innerHTML = criticalDeathRate;
}
function SetIcuCapacity() {
  icuCapacity = icuCapacitySelectorObj.value;
  icuCapacityLabelObj.innerHTML = icuCapacity;
}
function SetIcuDeathRate() {
  icuDeathRate = icuDeathRateSelectorObj.value;
  icuDeathRateLabelObj.innerHTML = icuDeathRate;
}
function SetPopPercent() {
  RI_PopPercent = popPercentSelectorObj.value;
  popPercentLabelObj.innerHTML = RI_PopPercent;

  let RI_TotalNew = Math.floor(RI_PopPercent*.01*balls.length);
  
  if (RI_TotalNew > RI_Total) {
    for (let i = RI_Total; i < RI_TotalNew; i++) {
      balls[i].speedFactor = 1 - (RI_SpeedReduction * .01);
    }
  }
  else if (RI_TotalNew < RI_Total) {
    for (let i = RI_TotalNew; i < RI_Total; i++) {
      balls[i].speedFactor = 1;
    }
  }
  
  RI_Total = RI_TotalNew;
}
function SetSpeedReduction() {
  RI_SpeedReduction = speedReductionSelectorObj.value;
  speedReductionLabelObj.innerHTML = RI_SpeedReduction;

  for (let i = 0; i < RI_Total; i++) {
    balls[i].speedFactor = 1 - (RI_SpeedReduction * .01);
  }
}

////////////////////////////////////////////////////
//////////// Working with HTML elements ////////////
////////////////////////////////////////////////////

// Functions for updating stats
function DecrementHealthy() {
  healthyCount--;
  healthyCountObj.innerHTML = healthyCount;
}
function IncrementInfected() {
  infectedCount++;
  infectedCountObj.innerHTML = infectedCount;
  DecrementHealthy();
}
function DecrementInfected() {
  infectedCount--;
  infectedCountObj.innerHTML = infectedCount;
  if (infectedCount <= 0) {
    simEndTimerId = taskScheduler.add(StopSim, 1000, false);
  }
}
function IncrementRecovered() {
  recoveredCount++;
  recoveredCountObj.innerHTML = recoveredCount;
  DecrementInfected();
}
function IncrementDeaths() {
  deathCount++;
  deathCountObj.innerHTML = deathCount;
  DecrementInfected();
}
function IncrementCritical() {
  criticalCount++;
  criticalCountObj.innerHTML = criticalCount;
}
function DecrementCritical() {
  criticalCount--;
  criticalCountObj.innerHTML = criticalCount;
}
function IncrementIcu() {
  icuCount++;
  icuCountObj.innerHTML = icuCount;
}
function DecrementIcu() {
  icuCount--;
  icuCountObj.innerHTML = icuCount;
}
