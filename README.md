# TransmissionSim
An interactive contagion transmission simulator. The simulation panel uses canvas to draw the dots. The chart uses d3 v5.

Try it [here](https://chrond.github.io/TransmissionSim/)

## Overview

The movement of the balls roughly simulates the chance of contact with a nearby members of the community.
Increasing the speed of an individual ball generally increases the rate at which it will contact others.

## Purpose

This simplistic bouncing ball simulation aids in the visualization of the transmission of a contagion within a community.

At the end of the simulation, a stacked area chart is displayed that shows the count of the infected members over time.

During the simulation, parameters can be changed which can affect the curve of the graph. For example, you can reduce the speed of a certain percentage of the population. The speed can be adjusted at any time during the simulation, and you can see the effect that it has on the curve that is produced.

## Technology Used

- To render the circles, HTML5 canvas with WebGL is used.
- D3 is used to render the chart.
- I wrote a custom Javascript scheduler to drive the simulation and handle events.
