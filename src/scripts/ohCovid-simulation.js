import * as d3 from 'd3'
import * as topojson from 'topojson'
import {Scrubber} from 'Scrubber'
let pymChild

const margin = { top: 0, left: 0, right: 0, bottom: 0 }
const height = 640 - margin.top - margin.bottom
const width = 640 - margin.left - margin.right

const svg = d3
  .select('#covid-simulation')
  .attr('viewBox', [0, 0, width, height])
  .append('svg')
  .attr('height', height + margin.top + margin.bottom)
  .attr('width', width + margin.left + margin.right)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

//////////////////////////////////////////////////////////////// TOOLTIP////////////////////////////////

const tooltip = d3
  .select('body')
  .append('div')
  .attr('id', 'tooltip')
  .style('visibility', 'hidden')

function mouseOver(d, i) {
  // add custom tooltip html
  tooltip
    .attr('data-html', 'true')
    .style('visibility', 'visible')
    .html(
      `<div class='row'><b>${
        d.properties.NAME} County</div>`
    )

  tooltip.style('stroke', 'red').style('stroke-width', 0.3)
}

function mouseMove(d, widthEl) {
  const x = d3.event.pageX
  const y = d3.event.pageY
  const toolTipWidth = tooltip.node().getBoundingClientRect().width
  const toolTipMargin = 10
  const offset = d3
    .select('#covid-simulation')
    .node()
    .getBoundingClientRect().x

  let parsedX = x + toolTipMargin
  if (parsedX > widthEl / 2 + toolTipMargin * 2 + offset)
    parsedX = parsedX - toolTipWidth - toolTipMargin

  tooltip.style('left', `${parsedX}px`).style('top', `${y + toolTipMargin}px`)
}

function mouseOut(d) {
  // mouseout transitions
  tooltip.style('visibility', 'hidden')
}
////////////////////////////////TOOLTIP ENDS////////////////////////////////

const parseTime = d3.timeParse('%Y-%m-%d')
const colors =  ['#e6e6e6', '#f2df91', '#f9c467', '#ffa93e', '#ff8b25', '#fd6a0b', '#f04f08', '#d8382e', '#c62832', '#af1c43', '#8a1739', '#701547']

  // Geo Scale//
const projection = d3.geoMercator()
const path = d3.geoPath().projection(projection)

const colorScale = d3.scaleLinear().range(['#f1f1f1', 'green'])
let index = 0
const delay = 1

Promise.all([
    d3.json(require("/data/ohioCounties.json")),
    d3.csv("https://raw.githubusercontent.com/louisvillepublicmedia/ohio-valley-counties-covid-animation/main/ohio-counties-covid-data.csv")
    ])
    .then(ready)
    .catch(err => console.log('Failed on', err))

function ready([json, raw]) {
  ///reading and filtering raw data////
  raw = raw.filter(d => d.state == 'Ohio')
  raw.map(d => d.datetime = parseTime(d.date))
  const dates = [...new Set(raw.map(d => d.date))]

  colorScale.domain([0, d3.max(raw, d => +d.cases)])
  
  ///json file///
  const counties = topojson.feature(json, json.objects.ohioCounties)
  counties.features.map(function(d){
    d.properties.GEOID = +d.properties.GEOID
  })  
  projection.fitSize([width, height], counties)

  const map = svg
    .append('g')
    .selectAll('path')
    .data(counties.features)
    .join('path')
    .attr('d', path)
    .attr('class', 'county')
    .style('stroke', 'lightgrey')
    .style('stroke-width', 0.1)
    .on('mouseover', d => mouseOver(d))
    .on('mousemove', d => mouseMove(d))
    .on('mouseout', d => mouseOut(d))

  
  const getFilteredData = () => {
    var filtered = [...raw].filter(d => d.date === dates[index])
    var totalsMap = new Map(filtered.map(d => [+d.fips, d]))
    return totalsMap
  }
  function casesMap() {
    map.transition().attr('fill', d =>
      getFilteredData().get(d.properties.GEOID)
        // ? colorScale(+getFilteredData().get(d.properties.GEOID).cases)
        // : '#fff'
        ? d3.interpolateReds(Math.log(+getFilteredData().get(d.properties.GEOID).cases)/Math.log(10) / 6) : 'white'
    )
  }
  casesMap()
  // Make a new scrubber
  var scrubber = new ScrubberView()
  document.querySelector('#scrubber-wrapper').appendChild(scrubber.elt)
  scrubber.onValueChanged = idx => {
    index = idx
    casesMap()
    d3.select('#timerText').html(index)
  }

  d3.select('#cases-layer').on('click', function(){
    d3.select("#casesImage").style('visibility', 'visible')
    d3.select("#deathsImage").style('visibility', 'hidden')
    casesMap()  
    scrubber.onValueChanged = idx => {
      index = idx
      casesMap()
      d3.select('#timerText').html(index)
    }
  })

  d3.select('#deaths-layer').on('click', function(){
    d3.select("#deathsImage").style('visibility', 'visible')
    d3.select("#casesImage").style('visibility', 'hidden')
    function deathsMap() {
      map.transition().attr('fill', d =>
        getFilteredData().get(d.properties.GEOID)
          // ? colorScale(+getFilteredData().get(d.properties.GEOID).deaths)
          // : '#fff'
          ? d3.interpolateBlues(Math.log(+getFilteredData().get(d.properties.GEOID).deaths)/Math.log(10) / 5) : 'white'
      )
    }
    deathsMap()
    scrubber.onValueChanged = idx => {
      index = idx
      deathsMap()
      d3.select('#timerText').html(index)
    }
  })

  let iterateIndex = null
  function timer() {
    if (index <= dates.length-1){
      index = index + 1
      scrubber.value(index)
      // colorMap()
    } else (clearInterval(iterateIndex))
  }

    d3.select('button#play-chart').on('click', function() {
        index = 0
        iterateIndex = setInterval(timer, delay)
        d3.select('button#play-chart').text('Restart')
    })

    scrubber.min(0).max(dates.length-1).step(1).value(0).orientation('horizontal')

  function render (){
    const svgContainer = svg.node().closest('div')
    const svgWidth = svgContainer.offsetWidth
    // Do you want it to be full height? Pick one of the two below
    const svgHeight = height + margin.top + margin.bottom
    // const svgHeight = window.innerHeight

    const actualSvg = d3.select(svg.node().closest('svg'))
    actualSvg.attr('width', svgWidth).attr('height', svgHeight)

    const newWidth = svgWidth - margin.left - margin.right
    const newHeight = svgHeight - margin.top - margin.bottom
          // Geo Scale//
    const projection = d3.geoMercator()
    const path = d3.geoPath().projection(projection)

    projection.fitSize([newWidth, newHeight], counties)

   svg
    .selectAll('.county')
    .attr('d', path)
   //   // send the height to our embed
   if (pymChild) pymChild.sendHeight()
  }

  // // kick off the graphic and then listen for resize events
  render()
  window.addEventListener('resize', render)

  // // for the embed, don't change!
  if (pymChild) pymChild.sendHeight()
  pymChild = new pym.Child({ polling: 200, renderCallback: render })

}
