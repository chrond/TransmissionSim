
//Chart uses the d3 library

//Chart(color_dead, color_infected, color_initial, color_recovered)

function Chart (color0, color1, color2, color3) {

  let chartData = [[],[],[],[]];
  let chartWidth, chartHeight;
  let chartInnerWidth, chartInnerHeight;
  let chartMargin = {top: 10, right: 30, bottom: 30, left: 60};
  let chartXAxis = null;
  let chartYAxis = null;
  let secondsElapsed = 0;

  let output = {
    Initialize: function (containerId) {
      chartHeight = document.getElementById(containerId).clientHeight;
      chartWidth = document.getElementById(containerId).clientWidth;
      
      chartInnerHeight = chartHeight - chartMargin.top - chartMargin.bottom;
      chartInnerWidth = chartWidth - chartMargin.left - chartMargin.right;
      
      let svg = d3.select("#" + containerId)
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .append("g")
        .attr("transform",
              "translate(" + chartMargin.left + "," + chartMargin.top + ")");
      ;

      return svg;
    },

    Reset: function () {
      chartData = [[],[],[],[]];
      chartData[0].color = color0;
      chartData[1].color = color1;
      chartData[2].color = color2;
      chartData[3].color = color3;
      secondsElapsed = 0;
      
      // Remove all components from the chart
      if (chartXAxis) chartXAxis.remove();
      if (chartYAxis) chartYAxis.remove();
      chartSvg.selectAll("path").remove();
    },

    Update: function (deathCount, infectedCount, healthyCount, recoveredCount) {
      //chart data will have four layers stacked on top of each other
      chartData[0].push([secondsElapsed, 0, deathCount]);
      let infectedPos = deathCount + infectedCount;
      chartData[1].push([secondsElapsed, deathCount, infectedPos]);
      let healthyPos = infectedPos + healthyCount;
      chartData[2].push([secondsElapsed, infectedPos, healthyPos]);
      let recoveredPos = healthyPos + recoveredCount;
      chartData[3].push([secondsElapsed, healthyPos, recoveredPos]);

      secondsElapsed++;
    },

    Draw: function (totalPopulation) {
      let xAxisScale = d3.scaleLinear()
        .domain([0, secondsElapsed])
        .range([0, chartInnerWidth]);

      let yAxisScale = d3.scaleLinear()
        .domain([0, totalPopulation])
        .range([chartInnerHeight, 0]);

      let chartArea = d3.area()
        .x(function(d, i) { return xAxisScale(d[0]); })
        .y0(function(d) { return yAxisScale(d[1]); })
        .y1(function(d) { return yAxisScale(d[2]); });

      // Show the area
      chartSvg.selectAll("chartLayer")
        .data(chartData) //For each of the four arrays in chartData
        .join( enter =>
          enter.append("path") //Add a path
          .style("fill", function(d) { return d.color; })
          .attr("d", chartArea)
        );
        
      // Add X axis
      chartXAxis = chartSvg.append("g")
        .attr("transform", "translate(0," + chartInnerHeight + ")")
        .call(d3.axisBottom(xAxisScale).ticks(5));
        
      // Add Y axis
      chartYAxis = chartSvg.append("g")
        .call(d3.axisLeft(yAxisScale));
    }
  }
  
  return output;
}
