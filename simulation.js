
// The task scheduler for the main game loop
var fps = 60;
var gameLoopInterval = Math.floor(1000/fps);
var taskScheduler;

var balls = []; // array for ball objects
var critBalls = []; // array for balls in critical condition (waiting for icu)
var icuBalls = []; // array for balls in intensive care (in icu)

var ball_radius = 4;

var color_initial = 'rgb(90,160,255)';
var color_infected = 'rgb(180,100,60)';
var color_recovered = 'rgb(150,200,130)';
var color_critical = 'rgb(255,0,0)';
var color_icu = 'rgb(255,0,200)';
var color_dead = 'rgb(60,30,60)';

// Canvas images for each ball color
var ball_initial;
var ball_infected;
var ball_recovered;
var ball_critical;
var ball_icu;
var ball_dead;

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

//Canvas and chart DOM elements
var canvas;
var canvasContext;
var chartSvg


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
  canvas.height = canvas.clientHeight;
  canvas.width = canvas.clientWidth;
  canvasContext = canvas.getContext('2d', { alpha: false });
  
  // Clear canvas
  canvasContext.fillStyle = 'white';
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  
  // Initialize Simulation
  InitializeBalls();

  // Initialize Chart
  chart = new Chart(color_dead, color_infected, color_initial, color_recovered);
  chartSvg = chart.Initialize('graphArea');
  chart.Reset();
}


/////////////////////////////////////
///////////// Core Loop /////////////
/////////////////////////////////////

function CoreSimLoop() {
  ManageICU();
  for (let i = 0; i < balls.length; i++) {
    balls[i].Move();
    for (let j = i + 1; j < balls.length; j++) {
      ProcessCollision(i, j);
    }
  }
  
  //let n1 = performance.now();
  
  //Draw to canvas
  canvasContext.fillStyle = 'white';
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < balls.length; i++) {
    balls[i].Draw();
  }
  
  //console.log(performance.now() - n1);
}

/////////////////////////////////////
//////////// Ball Object ////////////
/////////////////////////////////////

function Ball(canvas, canvasContext, id, x, y, state, angle, radius, speed, highRisk) {
  this.posX = x;
  this.posY = y;
  this.radius = radius;
  this.speed = speed;
  this.highRisk = highRisk; // will become critical if infected
  this.canvas = canvas; // parent canvas
  this.canvasContext = canvasContext; // canvas drawing context
  this.id = id; // id of ball
  this.angle = angle; // initial angle of movement in radians
  this.color = color_initial;
  this.infectionTimerId = null;
  this.deathTimerId = null;
  this.criticalTimerId = null;
  this.speedFactor = 1; // dynamically changing speed factor for interaction reduction
  this.critical = false;
  this.icu = false;

  if (!this.angle)
    this.angle = Math.PI / 7;
  if (!this.radius)
    this.radius = ball_radius;
  if (!this.state)
    this.state = "initial";

  // angle is used only for initialization
  // direction and speed together is velocity
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
        break;
      default:
        this.state = newState;
        this.color = color_initial;
    }
    
    // if infected, start recovery timer
    if (this.state == "infected") {
      this.infectionTimerId = taskScheduler.add(
        DoRecover,
        recoveryTime*1000,
        false, //run once
        this, //bind to this context
        [this] //pass this as an argument
      );
      
      // if high risk, start critical timer
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
    
    // if dead, start death timer
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
  
  this.SetState(this.state); //set the color based on state

  this.GetImage = function () {
    let image = ball_initial;

    if (this.color === color_infected)
      image = ball_infected;
    else if (this.color === color_recovered)
      image = ball_recovered;
    else if (this.color === color_critical)
      image = ball_critical;
    else if (this.color === color_icu)
      image = ball_icu;
    else if (this.color === color_dead)
      image = ball_dead;

    return image;
  }

  this.Draw = function () {
    if (this.state != "buried") {
      // Draw the circle
      this.canvasContext.fillStyle = this.color;
      this.canvasContext.beginPath();
      this.canvasContext.arc(this.posX, this.posY, this.radius, 0, Math.PI*2, true);
      this.canvasContext.fill();
      
      // Draw the image
      //this.canvasContext.drawImage(this.GetImage(), Math.floor(this.posX-ball_radius), Math.floor(this.posY-ball_radius));
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
  }

  this.CheckBounds = function () {
    //Handle bounds collision
    if (this.posX >= this.canvas.width - this.radius) {
      this.posX = this.canvas.width - this.radius - 1;
      this.vx = -Math.abs(this.vx);
    }
    if ( this.posX <= this.radius) {
      this.posX = this.radius+1;
      this.vx = Math.abs(this.vx);
    }
    if (this.posY >= this.canvas.height - this.radius) {
      this.posY = this.canvas.height - this.radius - 1;
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
  var absx = Math.abs(parseFloat(ball2.posX) - parseFloat(ball1.posX));
  var absy = Math.abs(parseFloat(ball2.posY) - parseFloat(ball1.posY));

  // find distance between two balls.
  var distance = (absx * absx) + (absy * absy);
  distance = Math.sqrt(distance);
  // check if distance is less than sum of two radius - if yes, collision
  if (distance < (parseFloat(ball1.radius) + parseFloat(ball2.radius))) {
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
    let impulseX2 = ball2.posX - ball1.posX;
    let impulseY2 = ball2.posY - ball1.posY;
    
    if (impulseX1 != 0 || impulseY1 != 0) {
      // normalize the impulse vectors
      let impulseMag1 = Math.sqrt(impulseX1*impulseX1 + impulseY1*impulseY1);
      impulseX1 = impulseX1/impulseMag1;
      impulseY1 = impulseY1/impulseMag1;
      
      // set new velocity
      ball1.vx = impulseX1 * ball1.speed;
      ball1.vy = impulseY1 * ball1.speed;
    }
    if (impulseX2 != 0 || impulseY2 != 0) {
      // normalize the impulse vectors
      let impulseMag2 = Math.sqrt(impulseX2*impulseX2 + impulseY2*impulseY2);
      impulseX2 = impulseX2/impulseMag2;
      impulseY2 = impulseY2/impulseMag2;
      
      // set new velocity
      ball2.vx = impulseX2 * ball2.speed;
      ball2.vy = impulseY2 * ball2.speed;
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

function CreateCircleImage(radius, color) {
  let canvas = document.createElement('canvas');
  canvas.width = radius*2;
  canvas.height = radius*2;
  let context = canvas.getContext('2d');
  
  context.fillStyle = color;
  context.beginPath();
  context.arc(radius, radius, radius, 0, Math.PI*2, true);
  context.fill();
  
  return canvas;
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

  if (totalPopulation > 500)
    ball_radius = 3;
  else
    ball_radius = 4;
  
  // Prepare ball images (these are only used when drawing images rather than arcs)
  ball_initial = CreateCircleImage(ball_radius, color_initial);
  ball_infected = CreateCircleImage(ball_radius, color_infected);
  ball_recovered = CreateCircleImage(ball_radius, color_recovered);
  ball_critical = CreateCircleImage(ball_radius, color_critical);
  ball_icu = CreateCircleImage(ball_radius, color_icu);
  ball_dead = CreateCircleImage(ball_radius, color_dead);
  
  // Determine initial ball locations
  let boundsArea = canvas.width * canvas.height;
  let ballSpace = boundsArea / totalPopulation;
  let ballLength = Math.sqrt(ballSpace);
  let ballCountX = 0, ballCountY = 0, areaCapacity = 0;
  do {
    ballCountX = Math.floor(canvas.width / ballLength);
    ballCountY = Math.floor(canvas.height / ballLength);
    areaCapacity = ballCountX * ballCountY;
    
    if (areaCapacity < totalPopulation) {
      ballLength--;
    }
  }
  while (areaCapacity < totalPopulation && ballLength > ball_radius*2 + 1);

  // Expand height and width to fill the area
  let ballWidth = Math.floor(canvas.width / ballCountX);
  let ballHeight = Math.floor(canvas.height / ballCountY);
  
  // Add the balls
  let row = 0, col = 0;
  for (let i = 0; i < totalPopulation; i++) {
    let x = col*ballWidth + Math.floor(ballWidth/2);
    let y = row*ballHeight + Math.floor(ballHeight/2);
    
    let highRisk = Math.random() < criticalCaseRate;
    
    //Add ball
    balls.push(new Ball(canvas, canvasContext, 'n'+(i+1).toString(), x, y, "initial", Math.random()*2*Math.PI, ball_radius, speed, highRisk));
    
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
