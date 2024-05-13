// Import D3
import * as d3 from 'd3';
import { updateScatterplot } from './views/ScatterPlot.js'

const videoFolder = "data/video/"
const videoPlayer = document.getElementById('video-player');
let dataFiles, videoPath, selectedItems,uniqueTrials, uniqueSubjects,
    selectedScatterSource, selectedGroupby, selectedFilter, selectedFnirs,
    scatterSvg, scatterGroup, scatterScaleEncoding, 
    fnirsSvg, fnirsGroup,
    eventTimelineSvg , eventTimelineGroup, xEventTimelineScale, reverseTimelineScale,
    matrixSvg, matrixGroup, matrixTooltip,
    hl2Svg, hl2Group,
    fnirsSessionsSvg, fnirsSessionsGroup,
    timeDistSvg, timeDistGroup,
    selectedGaze, selectedImu;

let allTimestamps = {}
let brushedTrial = null;
let brushedSubject = null;
let vidStart = 0;
let vidEnd = 5;
let maxTimestamp=0.0;
let brushesAdded=[]
let brushIndices=[]
const allSteps = ["a", "b", "c", "d", "e", "f", "?", "*", "1", "2", "v"]

let modifiedSchemePaired = d3.schemePaired
modifiedSchemePaired.splice(4,2);
modifiedSchemePaired.push("white")

const stepColorScale = d3.scaleOrdinal()
  .domain(allSteps)
  .range(modifiedSchemePaired);

const margins={ 
    scatterplot:{ top:40, left:30, right:110, bottom:15},
    fnirs:{top:50, left:47, right:10, bottom:10},
    timeDist:{top:30, left:30, right:30, bottom: 10},
    eventTimeline:{top:25, left:55, right:16, bottom:20},
    matrix:{top:25, left:5, right:5, bottom:20},
    fnirsSessions:{top:25, left:10, right:10, bottom:20},   
    hl2:{top:55, left:45, right:23, bottom:10},
    video:{ top:0, left:0, right:0, bottom:0},
}

Promise.all([
        d3.csv("data/scatterplot_imu_gaze_complete.csv"),
        d3.json("data/formatted_mission_log_seconds.json"),
        d3.json("data/steps_error_distribution.json"),
        d3.json("data/FNIRS_sampled.json"),
        d3.json("data/fnirs_distribution.json"),
        d3.json("data/step_switch_error.json"),
        d3.csv("data/gaze_sampled.csv"),
        d3.csv("data/imu_sampled.csv"),
        d3.json("data/all_correlations.json"),
        d3.json("data/sessions_metadata.json"),
    ])
    
    .then(function(files) {
        dataFiles = files;
        initializeContainers();
        updateScatterplot(selectedGroupby, selectedFilter, selectedScatterSource,  margins, dataFiles, scatterGroup, scatterSvg, scatterScaleEncoding, selectedItems);
        updateFnirsAgg(selectedItems);
        updateTimeDistribution();
    })
    .catch(function(err) {
    console.log(err)
    console.log("Data Files not loaded!")
})

function initializeContainers(){
    console.log("initializing")
    
    // Extract unique sources from the data
    const sources = [...new Set(dataFiles[0].map(d => d.source))];
    uniqueTrials = [...new Set(dataFiles[0].map(d => d.trial))]
    uniqueSubjects = [...new Set(dataFiles[0].map(d => d.subject))]
    // Populate dropdown with options
    const sourceDropdown = d3.select("#source-dropdown");
    sourceDropdown.selectAll("option")
        .data(sources)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d)
        .attr("selected", (d, i) => i === 0 ? "selected" : null);
    
    // Add onchange event to get dropdown source and update scatterplot
    sourceDropdown.on("change", function() {
        selectedScatterSource = sourceDropdown.property("value");
        updateScatterplot(selectedGroupby, selectedFilter, selectedScatterSource,  margins, dataFiles, scatterGroup, scatterSvg, scatterScaleEncoding, selectedItems);
        // selectedItems = [];
        updateFnirsAgg(selectedItems);
        updateTimeDistribution();
        updateEventTimeline();
        updateMatrix();
        updateFnirsSessions();
        updateHl2Details();
    });

    const groupbyDropdown = d3.select("#groupby-dropdown");
        
    // Add onchange event to get groupBy and update scatterplot
    groupbyDropdown.on("change", function() {
        selectedGroupby = groupbyDropdown.property("value");
        updateScatterplot(selectedGroupby, selectedFilter, selectedScatterSource,  margins, dataFiles, scatterGroup, scatterSvg, scatterScaleEncoding, selectedItems);
        // selectedItems = [];
        updateFnirsAgg(selectedItems);
        updateTimeDistribution();
        updateEventTimeline();
        updateMatrix();
        updateFnirsSessions();
        updateHl2Details();
    });
    
    const filterDropdown = d3.select("#filter-dropdown");
    
    // Add onchange event to get groupBy and update scatterplot
    filterDropdown.on("change", function() {
        selectedFilter = filterDropdown.property("value");
        updateScatterplot(selectedGroupby, selectedFilter, selectedScatterSource,  margins, dataFiles, scatterGroup, scatterSvg, scatterScaleEncoding, selectedItems);
        // selectedItems = [];
        updateFnirsAgg(selectedItems);
        updateTimeDistribution();
        updateEventTimeline();
        updateMatrix();
        updateFnirsSessions();
        updateHl2Details();
    });

    const fnirsDropdown = d3.select("#fnirs-dropdown");
    
    // Add onchange event to get groupBy and update scatterplot
    fnirsDropdown.on("change", function() {
        selectedFnirs = fnirsDropdown.property("value");
        updateEventTimeline();
        updateMatrix();
        updateFnirsSessions();
        updateHl2Details();
    });

    d3.select("#corr-checkbox").on("change", function() {
        updateFnirsSessions();
    });

    const gazeDropdown = d3.select("#gaze-dropdown");

    gazeDropdown.on("change", function() {
        selectedGaze = gazeDropdown.property("value");
        updateHl2Details();

    });

    const imuDropdown = d3.select("#imu-dropdown");

    imuDropdown.on("change", function() {
        selectedImu = imuDropdown.property("value");
        updateHl2Details();
    });;

    //initialise select variables
    selectedScatterSource = sourceDropdown.property("value");
    selectedGroupby=groupbyDropdown.property("value");
    selectedFilter = filterDropdown.property("value");
    selectedFnirs = fnirsDropdown.property("value");
    selectedItems = [];
    selectedGaze = gazeDropdown.property("value");
    selectedImu = imuDropdown.property("value")
    //initialise svgs

    //scatterplot
    let scatterplotDiv = d3.select("#scatterplot-container") 
    scatterSvg = scatterplotDiv
        .append("svg")
        .attr("width", scatterplotDiv.node().clientWidth)
        .attr("height", scatterplotDiv.node().clientHeight)
        
    scatterGroup= scatterSvg.append("g")
        .attr("transform", `translate(${margins.scatterplot.left}, ${margins.scatterplot.top})`)
        .attr("width", scatterplotDiv.node().clientWidth -margins.scatterplot.left - margins.scatterplot.right )
        .attr("height", scatterplotDiv.node().clientHeight - margins.scatterplot.top - margins.scatterplot.bottom);

    
    //fnirs agg legend

    let legendSvg = d3.select("#legend-svg")
    
    legendSvg.append("text")
    .attr("x",5)
    .attr("y", 13)
    .attr("text-anchor","start")
    .style("font-size","11px" )
    .text("Mental")
    .append("tspan")
    .attr("x", 7)
    .attr("dy","1.2em")
    .text("State"); 

    legendSvg.append("rect")
        .attr("x",45)
        .attr("y", 10)
        .attr("height", 9)
        .attr("width", 9)
        .attr("fill", "#99070d");
    
    legendSvg.append("text")
        .attr("x",55)
        .attr("y", 18)
        .attr("text-anchor","start")
        .style("font-size","10px" )
        .text("Overload");

    legendSvg.append("rect")
        .attr("x",105)
        .attr("y",10)
        .attr("height", 9)
        .attr("width", 9)
        .attr("fill", "#eb5a4d");

    legendSvg.append("text")     
        .attr("x", 115)
        .attr("y",18)
        .attr("text-anchor","start")
        .style("font-size","10px" )
        .text("Optimal");

    legendSvg.append("rect")
        .attr("x",160)
        .attr("y", 10)
        .attr("height", 8)
        .attr("width", 8)
        .attr("fill", "#ffb0b0");
    
    legendSvg.append("text")
        .attr("x",170)
        .attr("y", 18)
        .attr("text-anchor","start")
        .style("font-size","10px" )
        .text("Underload");

    //fnirs agg 
    let fnirsDiv= d3.select("#fnirs-agg-container")  
    fnirsSvg = fnirsDiv.append("svg")
        .attr("width", fnirsDiv.node().clientWidth)
        .attr("height", 500)

    fnirsGroup = fnirsSvg.append("g")
        .attr("transform", `translate(${margins.fnirs.left}, ${margins.fnirs.top})`)
        .attr("width", fnirsDiv.node().clientWidth -margins.fnirs.left - margins.fnirs.right )
        .attr("height", 400);    

    //add font
    let fontImportURL = 'https://fonts.googleapis.com/css?family=Lato|Open+Sans|Oswald|Raleway|Roboto|Indie+Flower|Gamja+Flower';

    let defs = fnirsSvg.append("defs");

    // Append the style element within the defs element to import fonts
    defs.append("style")
        .attr("type", "text/css")
        .text('@import url("' + fontImportURL + '");');
    
    let timeDistDiv= d3.select("#time-distribution-container") 
    timeDistSvg = timeDistDiv.append("svg")
        .attr("width", timeDistDiv.node().clientWidth)
        .attr("height", 500)

    timeDistGroup = timeDistSvg.append("g")
        .attr("transform", `translate(${margins.timeDist.left}, ${margins.timeDist.top})`)
        .attr("width", timeDistSvg.attr("width") - margins.timeDist.left - margins.timeDist.right )
        .attr("height", 400);    

    //eventtimeline
    let eventTimelineDiv= d3.select("#event-timeline-container")  
    eventTimelineSvg = eventTimelineDiv
        .append("svg")
        .attr("width", eventTimelineDiv.node().clientWidth)
        .attr("height", 200)
        
    eventTimelineGroup= eventTimelineSvg.append("g")
        .attr("transform", `translate(${margins.eventTimeline.left}, ${margins.eventTimeline.top})`)
        .attr("width", eventTimelineDiv.node().clientWidth -margins.eventTimeline.left - margins.eventTimeline.right )
        .attr("height", eventTimelineDiv.node().clientHeight - margins.eventTimeline.top - margins.eventTimeline.bottom);    

    //matrix
    let matrixDiv= d3.select("#matrix-container")  
    matrixSvg = matrixDiv
        .append("svg")
        .attr("width", matrixDiv.node().clientWidth)
        .attr("height", 200)
        
    matrixGroup = matrixSvg.append("g")
        .attr("transform", `translate(${margins.matrix.left}, ${margins.matrix.top})`)
        .attr("width", matrixDiv.node().clientWidth -margins.matrix.left - margins.matrix.right )
        .attr("height", matrixDiv.node().clientHeight - margins.matrix.top - margins.matrix.bottom);
    
    matrixTooltip =matrixDiv.append("div")
        .attr("class", "tooltip")
        .style("opacity",0.9)
        .style("visibility","hidden")
        .style("position", "absolute")
        .style("font-size","0.75em")
        //.style("width","150px")
        .style("z-index",1000)
        .style("background-color", "white")
        .style("padding", "8px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.2)")
        .style("text-align", "left"); // Add text-align: left to align text left;
    //fnirssessions
    let fnirsSessionsDiv= d3.select("#fnirs-sessions-container")  
    
    fnirsSessionsSvg = fnirsSessionsDiv
        .append("svg")
        .attr("width", fnirsSessionsDiv.node().clientWidth)
        .attr("height", 200)
        
    fnirsSessionsGroup = fnirsSessionsSvg.append("g")
        .attr("transform", `translate(${margins.fnirsSessions.left}, ${margins.fnirsSessions.top})`)
        .attr("width", fnirsSessionsDiv.node().clientWidth -margins.fnirsSessions.left - margins.fnirsSessions.right )
        .attr("height", fnirsSessionsDiv.node().clientHeight - margins.fnirsSessions.top - margins.fnirsSessions.bottom); 

    //hl2 details
    let hl2DetailsDiv= d3.select("#hl2-container")  

    hl2Svg = hl2DetailsDiv
        .append("svg")
        .attr("width", hl2DetailsDiv.node().clientWidth)
        .attr("height", 500)
        
    hl2Group = hl2Svg.append("g")
        .attr("transform", `translate(${margins.hl2.left}, ${margins.hl2.top})`)
        .attr("width", hl2DetailsDiv.node().clientWidth -margins.hl2.left - margins.hl2.right )
        .attr("height", hl2DetailsDiv.node().clientHeight - margins.hl2.top - margins.hl2.bottom); 
    

    
    //TIMESTAMP
    Object.keys(dataFiles[9]).forEach((subjectVal)=>{
        Object.keys(dataFiles[9][subjectVal]).forEach((trialVal)=>{
            if (trialVal == "4" && subjectVal=="8708") 
                dataFiles[9][subjectVal][trialVal].duration_seconds = dataFiles[9][subjectVal][trialVal].duration_seconds - 84004.747   
        
            allTimestamps['t'+trialVal+"-s"+subjectVal]=dataFiles[9][subjectVal][trialVal].duration_seconds
            maxTimestamp = Math.max(maxTimestamp,  dataFiles[9][subjectVal][trialVal].duration_seconds)
        })
    })

    dataFiles[1].forEach((trial)=>{
        //consolidate step data:
        let consolidatedStepData = {
            step: [],
            flightPhase: [],
            error: []
        };  
        let currentStep = null;
        let currentFlightPhase = null;
        let currentError = null;

        trial['data'].forEach(record => {

            if (record.seconds<0){
                return
            }

            // Consolidate 'Step' data
            if (record.Step !== currentStep) {
                if (consolidatedStepData.step.length > 0) {
                consolidatedStepData.step[consolidatedStepData.step.length - 1].endTimestamp = record.seconds;
                }
                consolidatedStepData.step.push({
                startTimestamp: record.seconds,
                endTimestamp: record.seconds,
                value: record.Step
                });
                currentStep = record.Step;
            } else {
                consolidatedStepData.step[consolidatedStepData.step.length - 1].endTimestamp = record.seconds;
            }

            // Consolidate 'FlightPhase' data
            if (record.FlightPhase !== currentFlightPhase) {
                if (consolidatedStepData.flightPhase.length > 0) {
                consolidatedStepData.flightPhase[consolidatedStepData.flightPhase.length - 1].endTimestamp = record.seconds;
                }
                consolidatedStepData.flightPhase.push({
                startTimestamp: record.seconds,
                endTimestamp: record.seconds,
                value: record.FlightPhase
                });
                currentFlightPhase = record.FlightPhase;
            } else {
                consolidatedStepData.flightPhase[consolidatedStepData.flightPhase.length - 1].endTimestamp = record.seconds;
            }

            // Consolidate 'Error' data
            if (record.Error !== currentError) {
                if (consolidatedStepData.error.length > 0) {
                consolidatedStepData.error[consolidatedStepData.error.length - 1].endTimestamp = record.seconds;
                }
                consolidatedStepData.error.push({
                startTimestamp: record.seconds,
                endTimestamp: record.seconds,
                value: record.Error
                });
                currentError = record.Error;
            } else {
                consolidatedStepData.error[consolidatedStepData.error.length - 1].endTimestamp = record.seconds;
            }
        });
        trial['consolidatedStepData'] = consolidatedStepData;
    })

    //consolidate FNIRS Data
    dataFiles[3].forEach((trial)=>{
        let consolidatedFNIRS = {
            workload: [],
            attention: [],
            perception: [],
        };

        //handle special case where the values are too high (timestamps out of sync)
        if (trial.trial_id == 4 && trial.subject_id==8708){
            trial.data = trial.data.map(item => {
                return {
                    ...item,
                    seconds: item.seconds - 84004.747
                };
            });
        }

        let currentWorkload = null;
        let currentAttention = null;
        let currentPerception = null;
        
        trial['data'].forEach(record=> {

            if (record.seconds<0 || record.seconds> allTimestamps['t'+trial.trial_id+"-s"+trial.subject_id]){
                return
            }
            // Consolidate 'Workload' data
            if (record.workload_classification !== currentWorkload) {
                if (consolidatedFNIRS.workload.length > 0) {
                consolidatedFNIRS.workload[consolidatedFNIRS.workload.length - 1].endTimestamp = record.seconds;
                }
                consolidatedFNIRS.workload.push({
                startTimestamp: record.seconds,
                endTimestamp: record.seconds,
                value: record.workload_classification
                });
                currentWorkload = record.workload_classification;
            } else {
                consolidatedFNIRS.workload[consolidatedFNIRS.workload.length - 1].endTimestamp = record.seconds;
            }
            
            //consolidate 'Attention' data
            if (record.attention_classification !== currentAttention) {
                if (consolidatedFNIRS.attention.length > 0) {
                consolidatedFNIRS.attention[consolidatedFNIRS.attention.length - 1].endTimestamp = record.seconds;
                }
                consolidatedFNIRS.attention.push({
                startTimestamp: record.seconds,
                endTimestamp: record.seconds,
                value: record.attention_classification
                });
                currentAttention = record.attention_classification;
            } else {
                consolidatedFNIRS.attention[consolidatedFNIRS.attention.length - 1].endTimestamp = record.seconds;
            }

            //consolidate 'Perception Data'
            if (record.perception_classification !== currentPerception) {
                if (consolidatedFNIRS.perception.length > 0) {
                consolidatedFNIRS.perception[consolidatedFNIRS.perception.length - 1].endTimestamp = record.seconds;
                }
                consolidatedFNIRS.perception.push({
                startTimestamp: record.seconds,
                endTimestamp: record.seconds,
                value: record.perception_classification
                });
                currentPerception = record.perception_classification;
            } else {
                consolidatedFNIRS.perception[consolidatedFNIRS.perception.length - 1].endTimestamp = record.seconds;
            }
        });
        trial['consolidatedFNIRS'] = consolidatedFNIRS; 
    })
}

export function updateFnirsAgg(selectedItems){
    console.log("updateFnirs")

    fnirsGroup.selectAll('*').remove();
    let fnirsFilteredData = dataFiles[4]

    if (selectedFilter!='all'){
        let trialFrequency = {};
        fnirsFilteredData.forEach(obj => {
            trialFrequency[obj.trial] = (trialFrequency[obj.trial] || 0) + 1;
        });
        // Step 2: Sort the values based on their frequencies
        let topTrialValues = Object.keys(trialFrequency).sort((a, b) => trialFrequency[b] - trialFrequency[a]).slice(0,selectedFilter=="t10"? 10 : 5);
        topTrialValues = topTrialValues.map(str => parseInt(str))
        fnirsFilteredData = fnirsFilteredData.filter((obj) => {return topTrialValues.includes(obj.trial)});
    }

    let fnirsFinalData = []

    if (selectedItems.length != 0)
    { 
        selectedItems.forEach((item)=>{
            //filter Mission File
            let tempObject = fnirsFilteredData.filter(obj => obj.subject == item.subject && obj.trial == item.trial);
            if (tempObject.length==0)
                return 
            fnirsFinalData.push(tempObject[0])
        })
    }
    else
        fnirsFinalData = fnirsFilteredData

    const proportions = calculateProportions(fnirsFinalData);
    const totalHeight = proportions.workload.length * 50;
    const newHeight = totalHeight + margins.fnirs.top + margins.fnirs.bottom;

    fnirsSvg.attr('height', newHeight+50);
    fnirsGroup.attr('height', newHeight+40);
    

    const categoryXScaleFnirs = d3.scaleBand()
        .domain(["workload", "attention", "perception"])
        .range([0, fnirsGroup.attr("width")])
        .paddingInner(0.20)
    
    const xScaleFnirs = d3.scaleLinear()
        .domain([0, 1]) // proportion scale
        .range([0, categoryXScaleFnirs.bandwidth()*0.45]);
    
    const xScaleCorrelations=d3.scaleLinear()
        .domain([-1,1])
        .range([categoryXScaleFnirs.bandwidth()*0.51, categoryXScaleFnirs.bandwidth()])

    let yScaleFnirs

    if(selectedGroupby=="trial"){
        yScaleFnirs = d3.scaleBand()
            .domain(proportions.attention.map(d => `Trial ${d.trial}`))
            .range([0, totalHeight])
            .paddingInner(0.4)
            .paddingOuter(0.1);
    }
    else{
        yScaleFnirs = d3.scaleBand()
            .domain(proportions.attention.map(d => `Sub ${d.subject}`))
            .range([0, totalHeight])
            .paddingInner(0.4)
            .paddingOuter(0.1);
    }
    
    // Create axes
    const xAxis = d3.axisTop(categoryXScaleFnirs)
        .tickFormat(function(d) {
            if (d === "workload") 
                return "Memory %"; // Change "workload" to "Memory"
             else 
                return d.charAt(0).toUpperCase() + d.slice(1)+" %"; // Capitalize other labels    
        });

    const yAxis = d3.axisLeft(yScaleFnirs);
    
    // Append axes to SVG
    fnirsGroup.append('g')
        .attr('class', 'x-axis axisHide')
        .attr('transform', `translate(${-categoryXScaleFnirs.bandwidth()*0.25}, -15)`)
        .call(xAxis)
        .selectAll(".tick")
        .attr("class", (d)=> "tick "+d)
        .on("click", (event, d)=>{
            d3.select("#fnirs-dropdown").property("value",d);
            selectedFnirs=d;
            updateFnirsAgg(selectedItems);
            updateTimeDistribution();
            updateEventTimeline();
            updateMatrix();
            updateFnirsSessions();
            updateHl2Details();
        })
        .selectAll("text")
        .style("font-family","Open Sans, Roboto, sans-serif")
        .style("font-size",  "12px")

    
    categoryXScaleFnirs.domain().forEach((domain)=>{
        fnirsGroup.append('text')
            .attr('x', categoryXScaleFnirs(domain) + 0.70 * categoryXScaleFnirs.bandwidth())
            .attr('y',-30)
            .style("font-family","Open Sans, Roboto, sans-serif")
            .style("font-size",  "12px")
            .style("font-weight","bold")
            .attr("class",domain)
            .text("Error")
            .append("tspan")
            .attr("dy","1.2em")
            .attr("x", categoryXScaleFnirs(domain) + 0.60 * categoryXScaleFnirs.bandwidth())
            .text(" Contribution")
    
        fnirsGroup.append('g')
            .attr('class', 'x-axis '+domain)
            .attr('transform', `translate(${categoryXScaleFnirs(domain)}, -3)`)
            .call(d3.axisTop(xScaleFnirs)
            .tickValues([0, 0.5, 1])
            .tickFormat(d=>Math.round(d*100)));
    })

    


    fnirsGroup.append('g')
        .attr('class', 'y-axis axisHide')
        .attr('transform', `translate(5, 0)`)
        .call(yAxis)
        .selectAll(".tick")
        .on("click",(event, d)=>{
            let id = d.split(" ")[1];

            scatterGroup.selectAll(".lasso>path")
            .attr("d","")

            selectedItems = []
            scatterGroup.selectAll('.scatterpoints').classed("unselectedscatter", true);

            scatterGroup.selectAll('.scatter-'+id).classed("unselectedscatter", false);
            let chosenSamples;
            if (selectedGroupby=="trial")
                chosenSamples = fnirsFilteredData.filter(d => d.trial == id)
            else
                chosenSamples = fnirsFilteredData.filter(d => d.subject == id)
            chosenSamples.forEach((sample)=>{
                selectedItems.push({trial:sample.trial ,subject:sample.subject})
            })
            updateFnirsAgg(selectedItems);
            updateTimeDistribution();
            updateEventTimeline();
            updateMatrix();
            updateFnirsSessions();
            updateHl2Details();

        })
        .selectAll("text")
        .style("font-size", "9px")
        .style("font-family","Open Sans, Roboto, sans-serif");
    
    
    // Create bars workload

    fnirsGroup.selectAll('.workload.overload')
        .data(proportions.workload)
        .enter()
        .append('rect')
        .attr('class', 'workload overload')
        .attr('x', categoryXScaleFnirs("workload"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) 
            else
                return yScaleFnirs(`Sub ${d.subject}`)
        })
        .attr('width', d => xScaleFnirs(d.overload))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', '#99070d');

    fnirsGroup.selectAll('.workload.optimal')
        .data(proportions.workload)
        .enter()
        .append('rect')
        .attr('class', 'workload optimal')
        .attr('x', categoryXScaleFnirs("workload"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) + yScaleFnirs.bandwidth()/3
            else
                return yScaleFnirs(`Sub ${d.subject}`) + yScaleFnirs.bandwidth()/3
        })
        .attr('width', d => xScaleFnirs(d.optimal))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', '#eb5a4d'); //#ef3b2c

    fnirsGroup.selectAll('.workload.underload')
        .data(proportions.workload)
        .enter()
        .append('rect')
        .attr('class', 'workload underload')
        .attr('x',categoryXScaleFnirs("workload"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) + (2 * yScaleFnirs.bandwidth()/3)
            else
                return yScaleFnirs(`Sub ${d.subject}`) + (2 * yScaleFnirs.bandwidth()/3)
        })
        .attr('width', d => xScaleFnirs(d.underload))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', "#ffb0b0");
        
        let groupArray = uniqueSubjects
        let correlations = dataFiles[8].subject_correlations
        if(selectedGroupby=="trial"){
            correlations = dataFiles[8].trial_correlations
            groupArray = uniqueTrials
            if (selectedFilter!="all"){
                let trialFrequency = {};
                dataFiles[4].forEach(obj => {
                    trialFrequency[obj.trial] = (trialFrequency[obj.trial] || 0) + 1;
                });
                //Sort trials based on their frequencies
                let topTrialValues = Object.keys(trialFrequency).sort((a, b) => trialFrequency[b] - trialFrequency[a]).slice(0,selectedFilter=="t10"? 10 : 5);
                groupArray = topTrialValues.map(str => parseInt(str))
            }

        }
        let selectedItemsArray =  selectedGroupby=="trial" ? selectedItems.map(obj => parseInt(obj.trial)) : selectedItems.map(obj => parseInt(obj.subject)) 
        groupArray.forEach((groupId)=>{
            if (selectedItems.length>0 && !selectedItemsArray.includes(parseInt(groupId)))
                return   
            
            let currentY = selectedGroupby=="trial" ? yScaleFnirs("Trial "+groupId) : yScaleFnirs("Sub "+groupId) 
            currentY += yScaleFnirs.bandwidth()/2

            categoryXScaleFnirs.domain().forEach((fnirsVariable)=>{
                let currentX = categoryXScaleFnirs(fnirsVariable)

                fnirsGroup.append('g')
                    .attr('class', "x-axis "+fnirsVariable)
                    .attr('transform', `translate(${currentX}, ${currentY})`)
                    .call(d3.axisBottom(xScaleCorrelations)
                    .tickValues([-1, -0.5, 0, 0.5, 1]));

                if(correlations[groupId]){
                    let optimalCorr = correlations[groupId][fnirsVariable+"_Optimal"]
                    let overloadCorr = correlations[groupId][fnirsVariable+"_Overload"]
                    let underloadCorr = correlations[groupId][fnirsVariable+"_Underload"]
                    if(optimalCorr != null)
                        fnirsGroup.append("rect")
                            .attr("x", currentX + xScaleCorrelations(optimalCorr))
                            .attr("y", currentY - 9)
                            .attr("fill", "#eb5a4d")
                            .attr("width", 9)
                            .attr("height", 9)
                            .attr("class",fnirsVariable);
        
                    if(overloadCorr != null)
                        fnirsGroup.append("rect")
                            .attr("x", currentX + xScaleCorrelations(overloadCorr))
                            .attr("y", currentY - 9)
                            .attr("fill", "#99070d")
                            .attr("width", 9)
                            .attr("height", 9)
                            .attr("class",fnirsVariable);
                    if(underloadCorr != null)
                        fnirsGroup.append("rect")
                            .attr("x",currentX + xScaleCorrelations(underloadCorr))
                            .attr("y", currentY - 9)
                            .attr("fill", "#ffb0b0")
                            .attr("width", 9)
                            .attr("height", 9)
                            .attr("class",fnirsVariable);         
                }
            })
        })

    // Create bars attention
    fnirsGroup.selectAll('.attention.overload')
        .data(proportions.attention)
        .enter()
        .append('rect')
        .attr('class', 'attention overload')
        .attr('x', categoryXScaleFnirs("attention"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) 
            else
                return yScaleFnirs(`Sub ${d.subject}`) 
        })
        .attr('width', d => xScaleFnirs(d.overload))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', '#99070d'); //#a50f15

    fnirsGroup.selectAll('.attention.optimal')
        .data(proportions.attention)
        .enter()
        .append('rect')
        .attr('class', 'attention optimal')
        .attr('x', categoryXScaleFnirs("attention"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) + yScaleFnirs.bandwidth()/3
            else
                return yScaleFnirs(`Sub ${d.subject}`) + yScaleFnirs.bandwidth()/3
        })
        .attr('width', d => xScaleFnirs(d.optimal))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', '#eb5a4d');

    fnirsGroup.selectAll('.attention.underload')
        .data(proportions.attention)
        .enter()
        .append('rect')
        .attr('class', 'attention underload')
        .attr('x',categoryXScaleFnirs("attention"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) + (2 * yScaleFnirs.bandwidth()/3)
            else
                return yScaleFnirs(`Sub ${d.subject}`) + (2 * yScaleFnirs.bandwidth()/3)
        })
        .attr('width', d => xScaleFnirs(d.underload))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', "#ffb0b0");

    // Create bars perception

    fnirsGroup.selectAll('.perception.overload')
        .data(proportions.perception)
        .enter()
        .append('rect')
        .attr('class', 'perception overload')
        .attr('x', categoryXScaleFnirs("perception"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`)
            else
                return yScaleFnirs(`Sub ${d.subject}`)  
        })
        .attr('width', d => xScaleFnirs(d.overload))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', '#99070d');

    fnirsGroup.selectAll('.perception.optimal')
        .data(proportions.perception)
        .enter()
        .append('rect')
        .attr('class', 'perception optimal')
        .attr('x', categoryXScaleFnirs("perception"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) + yScaleFnirs.bandwidth()/3
            else
                return yScaleFnirs(`Sub ${d.subject}`)  + yScaleFnirs.bandwidth()/3
        })
        .attr('width', d => xScaleFnirs(d.optimal))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', '#eb5a4d');

    fnirsGroup.selectAll('.perception.underload')
        .data(proportions.perception)
        .enter()
        .append('rect')
        .attr('class', 'perception underload')
        .attr('x',categoryXScaleFnirs("perception"))
        .attr('y', (d) => {
            if (selectedGroupby=="trial")
                return yScaleFnirs(`Trial ${d.trial}`) + (2 * yScaleFnirs.bandwidth()/3)
            else
                return yScaleFnirs(`Sub ${d.subject}`) + (2 * yScaleFnirs.bandwidth()/3)
        })
        .attr('width', d => xScaleFnirs(d.underload))
        .attr('height', yScaleFnirs.bandwidth()/3)
        .attr('fill', "#ffb0b0");
}


// Function to calculate proportions
export function calculateProportions(data) {
    const proportions = {
        workload : [],
        attention: [],
        perception : [],
    };
    let groupArray = uniqueTrials
    if (selectedGroupby== "subject")
        groupArray= uniqueSubjects
    groupArray.forEach((groupID)=>{

        let filteredData = data.filter(obj => obj.trial == groupID );

        if (selectedGroupby=="subject")
            filteredData = data.filter(obj => obj.subject == groupID );
        // Initialize an object to store the sum of values
        let sumOfValues = {};
        if (filteredData.length<1)
            return
        // Iterate over each object in the array
        filteredData.forEach(entry => {
            // Iterate over each key in the object
            Object.keys(entry).forEach(key => {
                // Skip 'subject' and 'trial'
                if (key !== 'subject' && key !== 'trial') {
                    // If the key doesn't exist in the sumOfValues object, initialize it to 0
                    sumOfValues[key] = sumOfValues[key] || 0;
                    // Add the value of the current key to the sumOfValues object
                    sumOfValues[key] += entry[key] || 0; // If the key is absent, default its value to 0
                }
            });
        });
        let total = (sumOfValues['perception_classification_Optimal'] || 0) + (sumOfValues['perception_classification_Underload'] || 0) + (sumOfValues['perception_classification_Overload'] || 0);
        let optimal = (sumOfValues['perception_classification_Optimal'] || 0) / total;
        let underload = (sumOfValues['perception_classification_Underload'] || 0) / total;
        let overload = (sumOfValues['perception_classification_Overload'] || 0) / total;

        if (selectedGroupby == "trial")
            proportions['perception'].push({ trial: groupID, optimal: optimal, underload: underload, overload: overload });
        else
            proportions['perception'].push({ subject: groupID, optimal: optimal, underload: underload, overload: overload });

        total = (sumOfValues['attention_classification_Optimal'] || 0) + (sumOfValues['attention_classification_Underload'] || 0) + (sumOfValues['attention_classification_Overload'] || 0);
        optimal = (sumOfValues['attention_classification_Optimal'] || 0) / total;
        underload = (sumOfValues['attention_classification_Underload'] || 0) / total;
        overload = (sumOfValues['attention_classification_Overload'] || 0) / total;

        if (selectedGroupby == "trial")
            proportions['attention'].push({ trial: groupID,  optimal: optimal, underload: underload, overload: overload });
        else
            proportions['attention'].push({subject: groupID, optimal: optimal, underload: underload, overload: overload });

        total = (sumOfValues['workload_classification_Optimal'] || 0) + (sumOfValues['workload_classification_Underload'] || 0) + (sumOfValues['workload_classification_Overload'] || 0);
        optimal = (sumOfValues['workload_classification_Optimal'] || 0) / total;
        underload = (sumOfValues['workload_classification_Underload'] || 0) / total;
        overload = (sumOfValues['workload_classification_Overload'] || 0) / total;
        
        if (selectedGroupby == "trial")
            proportions['workload'].push({ trial: groupID,  optimal: optimal, underload: underload, overload: overload });
        else
            proportions['workload'].push({subject: groupID, optimal: optimal, underload: underload, overload: overload });

    });

    return proportions;
}

export function updateTimeDistribution(){
    timeDistGroup.selectAll('*').remove();
    let topTrialValues;
    let filteredTimeFile = {};
    let filteredTimeData = [];
    if (selectedFilter!="all"){
        let trialFrequency = {};
        dataFiles[4].forEach(obj => {
            trialFrequency[obj.trial] = (trialFrequency[obj.trial] || 0) + 1;
        });
        //Sort trials based on their frequencies
        topTrialValues = Object.keys(trialFrequency).sort((a, b) => trialFrequency[b] - trialFrequency[a]).slice(0,selectedFilter=="t10"? 10 : 5);
        topTrialValues = topTrialValues.map(str => parseInt(str))
    }
    else
        topTrialValues=uniqueTrials;
    // Store filtered keys in an object
    Object.keys(dataFiles[9]).forEach((subjectVal)=>{
        filteredTimeFile[subjectVal] = {}
        topTrialValues.forEach(trialVal => {
        if (trialVal in dataFiles[9][subjectVal]) 
            filteredTimeFile[subjectVal][trialVal] = dataFiles[9][subjectVal][trialVal];
        })
    })

    
    for (let subjectId in filteredTimeFile) {
        for (let trialId in filteredTimeFile[subjectId]) {
            filteredTimeData.push({
                trial: trialId,
                subject: subjectId,
                seconds: filteredTimeFile[subjectId][trialId].duration_seconds
            });
        }
    }

    // Check and filter if there's a matching subject and trial in selectedItems
    if (selectedItems.length>0){
        filteredTimeData = filteredTimeData.filter(obj => {
            return selectedItems.some(item => item.subject == obj.subject && item.trial == obj.trial);
        }); 
    }

    const groupAndCalculateAverage = (data, selectedGroupBy) => {
        const groupedData = data.reduce((groups, obj) => {
            const key = obj[selectedGroupBy];
            const group = groups.get(key) || { [selectedGroupBy]: key, totalSeconds: 0, count: 0 };
            group.totalSeconds += obj.seconds;
            group.count++;
            groups.set(key, group);
            return groups;
        }, new Map());
    
        const averages = Array.from(groupedData.values(), group => ({
            [selectedGroupBy]: group[selectedGroupBy],
            average: group.totalSeconds / group.count
        }));
    
        return averages;
    };

    
    let averageTimeData = groupAndCalculateAverage(filteredTimeData, selectedGroupby)

    if (selectedItems.length>0){
        let groupArray = uniqueSubjects
        if (selectedGroupby=="trial")
            groupArray = uniqueTrials;

        let indexMap = new Map();
        groupArray.forEach((id, i) => {
            indexMap.set(id, i);
        });

        // Sort data based on the order of selectedItems
        averageTimeData.sort((a, b) => {
            const indexA = indexMap.get(selectedGroupby == "trial" ? a.trial : a.subject);
            const indexB = indexMap.get(selectedGroupby == "trial" ? b.trial : b.subject);
            return indexA - indexB;
        });
    }
    const totalHeight = averageTimeData.length * 50;
    const newHeight = totalHeight + margins.fnirs.top + margins.fnirs.bottom;

    timeDistSvg.attr('height', newHeight+50);
    timeDistGroup.attr('height', newHeight+40);

    let yScaleTimeDist

    if(selectedGroupby=="trial"){
        yScaleTimeDist = d3.scaleBand()
            .domain(averageTimeData.map(d => `Trial ${d.trial}`))
            .range([0, totalHeight])
            .paddingInner(0.4)
            .paddingOuter(0.1);
    }
    else{
        yScaleTimeDist = d3.scaleBand()
            .domain(averageTimeData.map(d => `Sub ${d.subject}`))
            .range([0, totalHeight])
            .paddingInner(0.3)
            .paddingOuter(0.1);
    }

    let xScaleTimeDist = d3.scaleLinear()
        .domain([0,maxTimestamp])
        .range([0, d3.select("#time-distribution-container").node().clientWidth - margins.timeDist.left - margins.timeDist.right])

    timeDistGroup.selectAll("rect")
        .data(averageTimeData)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d) => {return selectedGroupby=="trial" ? yScaleTimeDist("Trial "+d.trial) +10: yScaleTimeDist("Sub "+d.subject)+26})
        .attr("height", 15)
        .attr("width", d => xScaleTimeDist(d.average))
        .attr("fill","#737373")

    timeDistGroup.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, -10)`)
        .call(d3.axisTop(xScaleTimeDist)
            .tickValues([0, maxTimestamp/2, maxTimestamp])
            .tickFormat(d => Math.round(d/60) + "min"));

    
}

export function updateEventTimeline(){   

    brushedSubject = null;
    brushedTrial = null;
    brushesAdded.splice(0, brushesAdded.length)
    brushIndices.splice(0, brushIndices.length)
    let brushCount = 0  
    eventTimelineGroup.selectAll('*').remove();

    d3.select("#fnirs-dropdown")
        .style("visibility","hidden");

    d3.select("#corr-checkbox")
        .style("visibility","hidden");

    d3.select("#corr-checkbox-label")
        .style("visibility","hidden");

    if (selectedItems.length == 0){
        return;
    }

    d3.select("#fnirs-dropdown")
        .style("visibility","visible");

    d3.select("#corr-checkbox")
        .style("visibility","visible");

    d3.select("#corr-checkbox-label")
        .style("visibility","visible");

    let filteredMissionData=[];
    let filteredFnirs = [];
    let currentY = margins.eventTimeline.top
    let groupArray = uniqueSubjects
    if(selectedGroupby=="trial")
        groupArray = uniqueTrials
    
    let yScaleLine =  d3.scaleLinear()
                        .domain([1.0,0])
                        .range([1,25])
                         

    xEventTimelineScale= d3.scaleLinear()
        .domain([0.0, maxTimestamp])
        .range([0, d3.select("#event-timeline-container").node().clientWidth -margins.eventTimeline.left - margins.eventTimeline.right ])  
    reverseTimelineScale = d3.scaleLinear()
        .domain([0, d3.select("#event-timeline-container").node().clientWidth -margins.eventTimeline.left - margins.eventTimeline.right ])
        .range([0.0, maxTimestamp])

    selectedItems.forEach((item)=>{
        //filter Mission File
        let tempObject = dataFiles[1].filter(obj => obj.subject_id == item.subject && obj.trial_id == item.trial);
        if (tempObject.length==0){
            console.log("ERROR:NO MATCH FOUND FOR SUBJECT AND TRIAL ID")
            tempObject= [{subject_id: item.subject, trial_id: item.trial, missing:true}]
        }
        else
            tempObject[0]["missing"]=false
        filteredMissionData.push(tempObject[0])
        
        //Filter Fnirs file
        tempObject = dataFiles[3].filter(obj => obj.subject_id == item.subject && obj.trial_id == item.trial);
        if (tempObject.length==0){
            console.log("ERROR:NO MATCH FOUND FOR SUBJECT AND TRIAL ID")
            tempObject= [{subject_id: item.subject, trial_id: item.trial, missing:true}]
        }
        else
            tempObject[0]["missing"]=false
        filteredFnirs.push(tempObject[0])
    })

    groupArray.forEach((id)=>{
        let groupedObj = filteredMissionData.filter(obj => obj.subject_id == id)
        if (selectedGroupby=="trial")
            groupedObj = filteredMissionData.filter(obj => obj.trial_id == id)
        if (groupedObj.length>0 && selectedGroupby=="trial")
            eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[1]/2 - margins.eventTimeline.left/2).attr("y", currentY-24).text("Trial "+ id).style("font-size", "16px").attr("text-anchor","middle").style("fill","black")
        else if (groupedObj.length>0 && selectedGroupby=="subject")
            eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[1]/2 - margins.eventTimeline.left/2).attr("y", currentY-24).text("Subject "+ id).style("font-size", "16px").attr("text-anchor","middle").style("fill","black")
        else
            return

        currentY+=5
        eventTimelineGroup.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${currentY})`)
            .call(d3.axisTop(xEventTimelineScale)
                .tickValues([0, maxTimestamp/2, maxTimestamp])
                .tickFormat(d => Math.round(d/60) + "min"));
        
        currentY+=15


        groupedObj.forEach((sessionMission)=>{
            let sessionFnirs = filteredFnirs.filter(obj => obj.subject_id == sessionMission.subject_id && obj.trial_id == sessionMission.trial_id)[0]  
            if (sessionMission.missing){
                let sessionTitle
            if (selectedGroupby=="trial")
                sessionTitle=eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0]-margins.eventTimeline.left + 6).attr("y", currentY+3).text("Sub "+ sessionMission.subject_id).style("font-size", "10px").attr("text-anchor","start").style("fill","black").attr("data-trial", sessionMission.trial_id).attr("data-subject", sessionMission.subject_id)
                .on("click",(event, d) =>{

                    let trialToRemove;
                    let subjectToRemove;
                    if (typeof event.target != 'undefined') {
                        trialToRemove = event.srcElement.getAttribute("data-trial")
                        subjectToRemove = event.srcElement.getAttribute("data-subject")
                    }
                    else{    
                        return
                    }
                    selectedItems = selectedItems.filter(function(item) {
                        return !(item.trial == trialToRemove && item.subject == subjectToRemove);
                    });
                    updateEventTimeline();
                    updateMatrix();
                    updateFnirsSessions();
                    updateHl2Details();
                    
                })
            else
                sessionTitle=eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0]-margins.eventTimeline.left + 6).attr("y", currentY+3).text("Trial "+ sessionMission.trial_id).style("font-size", "10px").attr("text-anchor","start").style("fill","black").attr("data-trial", sessionMission.trial_id).attr("data-subject", sessionMission.subject_id)
                .on("click",(event, d) =>{

                    let trialToRemove;
                    let subjectToRemove;
                    if (typeof event.target != 'undefined') {
                        trialToRemove = event.srcElement.getAttribute("data-trial")
                        subjectToRemove = event.srcElement.getAttribute("data-subject")
                    }
                    else{    
                        return
                    }
                    selectedItems = selectedItems.filter(function(item) {
                        return !(item.trial == trialToRemove && item.subject == subjectToRemove);
                    });
                    updateEventTimeline();
                    updateMatrix();
                    updateFnirsSessions();
                    updateHl2Details();
                    
                })

            let titlebbox = sessionTitle.node().getBBox();
            eventTimelineGroup.append("rect")
                .attr("x", titlebbox.x - 2)
                .attr("y", titlebbox.y - 2)
                .attr("width", titlebbox.width + 4)
                .attr("rx",5)
                .attr("ry",5)
                .attr("data-trial", sessionMission.trial_id)
                .attr("data-subject", sessionMission.subject_id)
                .attr("height", titlebbox.height + 4)
                .attr("stroke", "black")
                .style("fill", "none")
                .on("click", (event, d) => {
                    let trialToRemove;
                    let subjectToRemove;
                    if (typeof event.target != 'undefined') {
                        trialToRemove = event.srcElement.getAttribute("data-trial")
                        subjectToRemove = event.srcElement.getAttribute("data-subject")
                    }

                    else{
                        return
                    }
                    selectedItems = selectedItems.filter(function(item) {
                        return !(item.trial == trialToRemove && item.subject == subjectToRemove);
                    });
                    updateEventTimeline();
                    updateMatrix();
                    updateFnirsSessions();
                    updateHl2Details();

                });

                    
                let displayMissing= `Missing mission info for Subject:${sessionMission.subject_id} Trial:${sessionMission.trial_id}`

                if (sessionFnirs.missing)
                    displayMissing= `Missing Mission & FNIRS info for Subject:${sessionMission.subject_id} Trial:${sessionMission.trial_id}`
  
                let missingText = eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[1]/2).attr("y", currentY+28).text(displayMissing).style("font-size", "11px").attr("text-anchor","middle").style("fill","black").style("fill-opacity", 0.5)
                let bbox = missingText.node().getBBox();
                
                eventTimelineGroup.append("rect")
                    .attr("x", bbox.x - 2)
                    .attr("y", bbox.y - 2)
                    .attr("width", bbox.width + 4)
                    .attr("rx",5)
                    .attr("ry",5)
                    .attr("height", bbox.height + 4)
                    .attr("stroke", "black")
                    .style("stroke-opacity", 0.5)
                    .style("fill", "none");

                currentY+=40

                if(!sessionFnirs.missing){
                    let fnirsToDisplay = sessionFnirs.consolidatedFNIRS[selectedFnirs];
                    fnirsToDisplay.forEach(data => {
                        eventTimelineGroup.append("rect")
                            .attr("x", xEventTimelineScale(data.startTimestamp))
                            .attr("y", currentY+1)
                            .attr("width", xEventTimelineScale(data.endTimestamp) - xEventTimelineScale(data.startTimestamp)) 
                            .attr("height", 24)
                            .style("fill", () => {return data.value == "Underload" ? "#ffb0b0" : data.value == "Overload" ? "#99070d" : "#eb5a4d";});
                    });
                
                    let variableName= selectedFnirs + "_confidence" 
                    let duration= allTimestamps['t'+sessionFnirs.trial_id+"-s"+sessionFnirs.subject_id]

                    // Add the confidence line
                    eventTimelineGroup.append("path")
                        .datum(sessionFnirs.data.filter(function(d) { return d.seconds >= 0 && d.seconds<=duration; }))
                        .attr("fill", "none")
                        .attr("stroke", "#add8e6")
                        .attr("stroke-width", 1)
                        .attr("stroke-opacity", 0.8)
                        .attr("d", d3.line()
                        .x(function(d) { return xEventTimelineScale(d.seconds) })
                        .y(function(d) { return currentY + yScaleLine(d[variableName]) }))
                }
                
                currentY += 50

                eventTimelineGroup.append("rect")
                .attr("x", 0)
                .attr("y", currentY-90)
                .attr("rx", 7)
                .attr("ry", 7)
                .attr("width", xEventTimelineScale.range()[1])
                .attr("height", 80)
                .style("stroke", "black")
                .style("stroke-width", "0.5px")
                .style("stroke-opacity", 0.7)
                .style("fill", "none")
                .style("fill-opacity", 0)

                let brush = d3.brushX()
                    .extent([[0, currentY-90], [xEventTimelineScale.range()[1] , currentY-10]])
                    .on("start", brushstart)
                    .on("end", brushended);
                
                brushesAdded.push(brush)
                brushIndices.push({trial:sessionMission.trial_id, subject:sessionMission.subject_id, brushAt:brushCount})
                brushCount+=1
        
                eventTimelineGroup.append("g")
                    .attr("class", "brush timelinebrush brush-t"+sessionMission.trial_id+"-s"+sessionMission.subject_id)
                    .attr("data-trial",sessionMission.trial_id)
                    .attr("data-subject",sessionMission.subject_id)
                    .datum({brush:brush})
                    .call(brush);

                if(eventTimelineSvg.attr("height")<=currentY+220){
                    eventTimelineGroup.attr("height",currentY+220)
                    eventTimelineSvg.attr("height",currentY+270+margins.eventTimeline.top+margins.eventTimeline.bottom)     
                }
                return
            }
            let stepData = sessionMission.consolidatedStepData.step;
            let errorData = sessionMission.consolidatedStepData.error;
            let phaseData = sessionMission.consolidatedStepData.flightPhase;
            let fnirsToDisplay = sessionFnirs.consolidatedFNIRS[selectedFnirs];

            stepData.forEach(data => {
                eventTimelineGroup.append("rect")
                    .attr("x", xEventTimelineScale(data.startTimestamp))
                    .attr("y", currentY)
                    .attr("width", xEventTimelineScale(data.endTimestamp) - xEventTimelineScale(data.startTimestamp)) 
                    .attr("height", 25)
                    .style("fill", stepColorScale(data.value));
            });

            let fnirsLabel= selectedFnirs=="workload" ? "Memory" : selectedFnirs[0].toUpperCase() + selectedFnirs.slice(1);
        
            eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0] - 3).attr("y", currentY+18).text("Procedures").style("font-size", "9px").attr("text-anchor","end").style("fill","black")
            eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0]-3).attr("y", currentY+36).text("Errors").style("font-size", "9px").attr("text-anchor","end").style("fill","black")
            eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0]-3).attr("y", currentY+55).text(fnirsLabel).style("font-size", "9px").attr("text-anchor","end").style("fill","black")
            eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0]-3).attr("y", currentY+75).text("Phase").style("font-size", "9px").attr("text-anchor","end").style("fill","black")
        
           let sessionTitle
            if (selectedGroupby=="trial")
                sessionTitle=eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0]-margins.eventTimeline.left + 6).attr("y", currentY+3).text("Sub "+ sessionMission.subject_id).style("font-size", "10px").attr("text-anchor","start").style("fill","black").attr("data-trial", sessionMission.trial_id).attr("data-subject", sessionMission.subject_id)
                .on("click",(event, d) =>{

                    let trialToRemove;
                    let subjectToRemove;
                    if (typeof event.target != 'undefined') {
                        trialToRemove = event.srcElement.getAttribute("data-trial")
                        subjectToRemove = event.srcElement.getAttribute("data-subject")
                    }
                    else{    
                        return
                    }
                    selectedItems = selectedItems.filter(function(item) {
                        return !(item.trial == trialToRemove && item.subject == subjectToRemove);
                    });
                    updateEventTimeline();
                    updateMatrix();
                    updateFnirsSessions();
                    updateHl2Details();
                    
                })
            else
                sessionTitle=eventTimelineGroup.append("text").attr("x", xEventTimelineScale.range()[0]-margins.eventTimeline.left + 6).attr("y", currentY+3).text("Trial "+ sessionMission.trial_id).style("font-size", "10px").attr("text-anchor","start").style("fill","black").attr("data-trial", sessionMission.trial_id).attr("data-subject", sessionMission.subject_id)
                .on("click",(event, d) =>{

                    let trialToRemove;
                    let subjectToRemove;
                    if (typeof event.target != 'undefined') {
                        trialToRemove = event.srcElement.getAttribute("data-trial")
                        subjectToRemove = event.srcElement.getAttribute("data-subject")
                    }
                    else{    
                        return
                    }
                    selectedItems = selectedItems.filter(function(item) {
                        return !(item.trial == trialToRemove && item.subject == subjectToRemove);
                    });
                    updateEventTimeline();
                    updateMatrix();
                    updateFnirsSessions();
                    updateHl2Details();
                    
                })

            let bbox = sessionTitle.node().getBBox();
            eventTimelineGroup.append("rect")
                .attr("x", bbox.x - 2)
                .attr("y", bbox.y - 2)
                .attr("width", bbox.width + 4)
                .attr("rx",5)
                .attr("ry",5)
                .attr("data-trial", sessionMission.trial_id)
                .attr("data-subject", sessionMission.subject_id)
                .attr("height", bbox.height + 4)
                .attr("stroke", "black")
                .style("fill", "none")
                .on("click", (event, d) => {
                    let trialToRemove;
                    let subjectToRemove;
                    if (typeof event.target != 'undefined') {
                        trialToRemove = event.srcElement.getAttribute("data-trial")
                        subjectToRemove = event.srcElement.getAttribute("data-subject")
                    }

                    else{
                        return
                    }
                    selectedItems = selectedItems.filter(function(item) {
                        return !(item.trial == trialToRemove && item.subject == subjectToRemove);
                    });
                    updateEventTimeline();
                    updateMatrix();
                    updateFnirsSessions();
                    updateHl2Details();

                });

            
            currentY+=25;

            errorData.forEach(data => {
                eventTimelineGroup.append("rect")
                    .attr("x", xEventTimelineScale(data.startTimestamp))
                    .attr("y", currentY+1)
                    .attr("width", xEventTimelineScale(data.endTimestamp) - xEventTimelineScale(data.startTimestamp)) 
                    .attr("height", 14)
                    .style("fill", () => data.value == "error" || data.value == "Error" ? "black" : "#AEAEAE");
            });
            currentY+=15;

            fnirsToDisplay.forEach(data => {
                eventTimelineGroup.append("rect")
                    .attr("x", xEventTimelineScale(data.startTimestamp))
                    .attr("y", currentY+1)
                    .attr("width", xEventTimelineScale(data.endTimestamp) - xEventTimelineScale(data.startTimestamp)) 
                    .attr("height", 24)
                    .style("fill", () => {return data.value == "Underload" ? "#ffb0b0" : data.value == "Overload" ? "#99070d" : "#eb5a4d";});
            });
            let variableName= selectedFnirs + "_confidence" 
            let duration= allTimestamps['t'+sessionFnirs.trial_id+"-s"+sessionFnirs.subject_id]
            // Add the confidence line
            eventTimelineGroup.append("path")
                .datum(sessionFnirs.data.filter(function(d) { return d.seconds >= 0 && d.seconds<=duration }))
                .attr("fill", "none")
                .attr("stroke", "#add8e6")
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.8)
                .attr("d", d3.line()
                .x(function(d) { return xEventTimelineScale(d.seconds) })
                .y(function(d) { return currentY + yScaleLine(d[variableName]) }))
            
            currentY+=25;

            phaseData.forEach(data => {
                eventTimelineGroup.append("rect")
                    .attr("x", xEventTimelineScale(data.startTimestamp))
                    .attr("y", currentY+1)
                    .attr("width", xEventTimelineScale(data.endTimestamp) - xEventTimelineScale(data.startTimestamp)) 
                    .attr("height", 14)
                    .style("fill", () => data.value ==  "Preflight" ? "#8BC34A" : "#FF5722");

                eventTimelineGroup.append("rect")
                    .attr("x",  xEventTimelineScale(data.startTimestamp))
                    .attr("y", currentY+1)
                    .attr("width", xEventTimelineScale(data.endTimestamp) - xEventTimelineScale(data.startTimestamp))
                    .attr("height", 14)
                    .style("fill", "white")
                    .style("stroke", "black")
                    .style("stroke-width", "2px");
            
                eventTimelineGroup.append("text")
                    .attr("x", xEventTimelineScale(data.startTimestamp) + (xEventTimelineScale(data.endTimestamp) - xEventTimelineScale(data.startTimestamp)) /2) 
                    .attr("y", currentY + 11)
                    .attr("text-anchor", "middle") 
                    .style("font-size", "10px")
                    .style("fill", "black")
                    .text(()=> {
                        if (data.value === "Preflight") {
                            return "PF";
                        } else {
                            return "FL";
                        }
                    })
            });
            
            currentY+=15
            eventTimelineGroup.append("rect")
                .attr("x", 0)
                .attr("y", currentY-80)
                .attr("rx", 7)
                .attr("ry", 7)
                .attr("width", xEventTimelineScale.range()[1])
                .attr("height", 80)
                .style("stroke", "black")
                .style("stroke-width", "0.5px")
                .style("stroke-opacity", 0.7)
                .style("fill", "none")
                .style("fill-opacity", 0)
                //.style("stroke-dasharray", "10,10");

            let brush = d3.brushX()
                .extent([[0, currentY-80], [xEventTimelineScale.range()[1] , currentY]])
                .on("start", brushstart)
                .on("end", brushended);
            
            brushesAdded.push(brush)
            brushIndices.push[{trial:sessionMission.trial_id, subject:sessionMission.subject_id, brushAt:brushCount}]
            brushCount+=1

            eventTimelineGroup.append("g")
                .attr("class", "brush timelinebrush brush-t"+sessionMission.trial_id+"-s"+sessionMission.subject_id)
                .attr("data-trial",sessionMission.trial_id)
                .attr("data-subject",sessionMission.subject_id)
                .datum({brush:brush})
                .call(brush);
            //clear all other brushes when brushing starts
            function brushstart(){
                let allBrushes = eventTimelineGroup.selectAll(".timelinebrush").nodes()
                allBrushes.forEach((eachBrush)=>{
                    if (eachBrush !=this)
                        d3.select(eachBrush).call(d3.brush().move, null); 
                })
            }   

            function brushended (e){
                console.log("brush ended")

                matrixGroup.selectAll(".highlight-arcs")
                    .classed("highlight-arcs", false)

                matrixGroup.selectAll(".arc>path")
                    .style("fill-opacity",1)

                matrixGroup.selectAll(".circle")
                    .style("fill-opacity",1)


                if (e.selection == null){
                    brushedSubject = null;
                    brushedTrial = null; 
                    d3.selectAll(".hide-bar")
                        .classed("hide-bar",false);
                    updateHl2Details();
                    return
                }

                if (typeof e.sourceEvent != 'undefined') {
                    brushedTrial = e.sourceEvent.srcElement.parentElement.getAttribute("data-trial")
                    brushedSubject = e.sourceEvent.srcElement.parentElement.getAttribute("data-subject")
                }
                vidStart = reverseTimelineScale(e.selection[0])
                vidEnd = reverseTimelineScale(e.selection[1])
                videoPath = `data/video/${String(brushedSubject).padStart(4, '0')}/${brushedTrial}/hl2_rgb/codec_hl2_rgb_vfr.mp4`
                videoPlayer.src = videoPath;
                videoPlayer.addEventListener('loadeddata', function() {
                    videoPlayer.currentTime = vidStart;
                    videoPlayer.play();
                });
                videoPlayer.load();

                d3.selectAll(".error-session-bar")
                    .classed("hide-bar",true);
                d3.selectAll(".fnirs-session-bar")
                    .classed("hide-bar",true);
                d3.selectAll(".t"+brushedTrial+"-s"+brushedSubject)
                    .classed("hide-bar",false)

                let sessionObject = dataFiles[1].filter(obj => obj.subject_id == brushedSubject && obj.trial_id == brushedTrial)[0]
                let stepNames = new Set();
                sessionObject['consolidatedStepData'].step.forEach((step)=>{
                    if (step.startTimestamp > vidStart && step.startTimestamp < vidEnd)
                        stepNames.add(step.value)
                    else if (step.endTimestamp> vidStart && step.startTimestamp < vidEnd)
                        stepNames.add(step.value)
                })
                stepNames.forEach((name)=>{
                    let arcName = "arc-" + name + "-"+brushedSubject +"-" + brushedTrial;
                    let circleName = "circle-" + name + "-"+brushedSubject +"-" + brushedTrial;

                    let arcElements = document.getElementsByClassName(arcName)
                    if(arcElements.length==2){
                       arcElements[0].firstChild.classList.toggle("highlight-arcs") 
                       arcElements[1].firstChild.classList.toggle("highlight-arcs")   
                    } 

                    let circleElements = document.getElementsByClassName(circleName)
                    if(circleElements.length==1){
                        circleElements[0].classList.toggle("highlight-arcs")  
                    } 
                })
                matrixGroup.selectAll(".arc>path")
                    .style("fill-opacity",0.1)
                matrixGroup.selectAll(".circle")
                    .style("fill-opacity",0.1)
                matrixGroup.selectAll(".highlight-arcs")
                    .style("fill-opacity",1)
                updateHl2Details();
            }

            currentY+=10

            if (eventTimelineSvg.attr("height")<=currentY+200){
                eventTimelineGroup.attr("height",currentY+200)
                eventTimelineSvg.attr("height",currentY+250+margins.eventTimeline.top+margins.eventTimeline.bottom)     
            }
        })
        currentY+=50
        if (eventTimelineSvg.attr("height")<=currentY+200){
            eventTimelineGroup.attr("height",currentY+200)
            eventTimelineSvg.attr("height",currentY+250+margins.eventTimeline.top+margins.eventTimeline.bottom)     
        }
    })
}

export function updateFnirsSessions(){
    console.log("Updatefnirssessions")
    fnirsSessionsGroup.selectAll('*').remove();
    
    if (selectedItems.length<1)
        return
    let filteredObjects = []
    let xScaleFnirsSessions=  d3.scaleLinear()
                                .domain([0.0,1.0])
                                .range([0, fnirsSessionsGroup.attr("width")/2 - 10 ])
    
    fnirsGroup.selectAll(".workload").classed("hide-workload",true)
    fnirsGroup.selectAll(".attention").classed("hide-workload", true)
    fnirsGroup.selectAll(".perception").classed("hide-workload",true)

    fnirsGroup.selectAll("."+selectedFnirs).classed("hide-workload",false)
    
    selectedItems.forEach((item)=>{
        let tempObject = dataFiles[4].filter(obj => obj.subject == item.subject && obj.trial == item.trial);
        if (tempObject.length==0){
            console.log("ERROR: NO FNIRS SESSIONS DATA FOUND FOR SUBJECT AND TRIAL ID")
            tempObject= [{subject: item.subject, trial: item.trial, missing:true}]
        }
        
        else
            tempObject[0]["missing"]=false
        filteredObjects.push(tempObject[0]) 
    })

    let currentY = margins.fnirsSessions.top; 
    let groupArray = uniqueSubjects
    if(selectedGroupby=="trial"){
        groupArray = uniqueTrials
    }
    groupArray.forEach((id)=>{
        let groupedObj = filteredObjects.filter(obj => obj.subject == id)
        if (selectedGroupby=="trial")
            groupedObj = filteredObjects.filter(obj => obj.trial == id)
        if (groupedObj.length==0)
            return
            
    currentY+=10
    
    fnirsSessionsGroup.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${currentY})`)
        .call(d3.axisTop(xScaleFnirsSessions)
            .tickValues([0, 0.5, 1])
            .tickFormat(d => Math.round(d*100)));
    
    fnirsSessionsGroup.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(${xScaleFnirsSessions.range()[1]+15}, ${currentY})`)
        .call(d3.axisTop(xScaleFnirsSessions)
            .tickValues([0, 0.5, 1])
            .tickFormat(d => (d*100)));

    currentY+=10

        groupedObj.forEach((session)=>{
            let sessionObject = {
                subject: 0,
                trial: 0,
                workload_classification_Optimal: 0,
                workload_classification_Overload: 0,
                workload_classification_Underload: 0,
                attention_classification_Optimal: 0,
                attention_classification_Overload: 0,
                attention_classification_Underload: 0,
                perception_classification_Optimal: 0,
                perception_classification_Underload: 0,
                perception_classification_Overload: 0
            }

            Object.entries(session).forEach(([key, value]) => {sessionObject[key] = value});
            
            sessionObject['perception_classification_Total'] =  sessionObject.perception_classification_Optimal + sessionObject.perception_classification_Underload + sessionObject.perception_classification_Overload
            sessionObject['attention_classification_Total'] =  sessionObject.attention_classification_Optimal +  sessionObject.attention_classification_Underload +  sessionObject.attention_classification_Overload
            sessionObject['workload_classification_Total'] =   sessionObject.workload_classification_Optimal +  sessionObject.workload_classification_Underload +  sessionObject.workload_classification_Overload

            let variableName = selectedFnirs + "_classification_";
            
            //Overload
            fnirsSessionsGroup.append("rect")
                .attr("x", xScaleFnirsSessions.range()[1] + 15)
                .attr("y", currentY+5)
                .attr("width", xScaleFnirsSessions(sessionObject[variableName+"Overload"]/sessionObject[variableName+"Total"] ))
                .attr("height", 15)
                .style("fill", "#99070d" )
                .attr("class","fnirs-session-bar t"+sessionObject.trial+"-s"+sessionObject.subject);

            //optimal
            fnirsSessionsGroup.append("rect")
                .attr("x", xScaleFnirsSessions.range()[1] + 15)
                .attr("y", currentY+20)
                .attr("width", xScaleFnirsSessions(sessionObject[variableName+"Optimal"]/sessionObject[variableName+"Total"] ))
                .attr("height", 15)
                .style("fill", "#eb5a4d" )
                .attr("class","fnirs-session-bar t"+sessionObject.trial+"-s"+sessionObject.subject);

            //underload
            fnirsSessionsGroup.append("rect")
                .attr("x", xScaleFnirsSessions.range()[1] + 15)
                .attr("y", currentY+35)
                .attr("width", xScaleFnirsSessions(sessionObject[variableName+"Underload"]/sessionObject[variableName+"Total"] ))
                .attr("height", 15)
                .style("fill", "#ffb0b0" )                
                .attr("class","fnirs-session-bar t"+sessionObject.trial+"-s"+sessionObject.subject);

            

            let errorData = dataFiles[5].filter(obj => obj.subject_id == sessionObject.subject && obj.trial_id == sessionObject.trial)[0];
            
            if (errorData){
                //Non Error
                fnirsSessionsGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", currentY+5)
                    .attr("width", xScaleFnirsSessions((100-errorData['percentage_error'])/100 ))
                    .attr("height", 15)
                    .style("fill", "#AEAEAE" )
                    .attr("class","error-session-bar t"+errorData.trial_id+"-s"+errorData.subject_id);

                //Error
                fnirsSessionsGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", currentY+20)
                    .attr("width", xScaleFnirsSessions(errorData['percentage_error']/100 ))
                    .attr("height", 15)
                    .style("fill", "black" )
                    .attr("class","error-session-bar t"+errorData.trial_id+"-s"+errorData.subject_id);

            }

            else{
                fnirsSessionsGroup.append("text")
                    .attr("x", 0)
                    .attr("y", currentY + 25)
                    .style("font-size", "10px")
                    .attr("text-anchor","start")
                    .style("fill","black")
                    .text("Error data not found") 
                    .style("fill-opacity",0.5)  
                    
            }

            const xScaleCorrelations=d3.scaleLinear()
                .domain([-1,1])
                .range(xScaleFnirsSessions.range())

            if (d3.select("#corr-checkbox").property("checked") == true){

                fnirsSessionsGroup.append('g')
                    .attr('class', "x-axis t"+sessionObject.trial+"-s"+sessionObject.subject)
                    .attr('transform', `translate(0, ${currentY+60})`)
                    .call(d3.axisBottom(xScaleCorrelations)
                    .tickValues([-1, -0.5, 0, 0.5, 1]));
                
                let correlations = dataFiles[8].session_correlations[sessionObject.subject][sessionObject.trial]
                if (correlations!= null){
                    let optimalCorr = correlations[selectedFnirs+"_Optimal"]
                    let overloadCorr = correlations[selectedFnirs+"_Overload"]
                    let underloadCorr = correlations[selectedFnirs+"_Underload"]
                    if(optimalCorr != null)
                        fnirsSessionsGroup.append("rect")
                            .attr("x", xScaleCorrelations(optimalCorr))
                            .attr("y", currentY +51)
                            .attr("fill", "#eb5a4d")
                            .attr("width", 9)
                            .attr("height", 9)
                            .attr("class","t"+sessionObject.trial+"-s"+sessionObject.subject);    
                    if(overloadCorr != null)
                        fnirsSessionsGroup.append("rect")
                            .attr("x", xScaleCorrelations(overloadCorr))
                            .attr("y", currentY +51)
                            .attr("fill", "#99070d")
                            .attr("width", 9)
                            .attr("height", 9)
                            .attr("class","t"+sessionObject.trial+"-s"+sessionObject.subject);
                    if(underloadCorr != null)
                        fnirsSessionsGroup.append("rect")
                            .attr("x", xScaleCorrelations(underloadCorr))
                            .attr("y", currentY +51)
                            .attr("fill", "#ffb0b0")
                            .attr("width", 9)
                            .attr("height", 9)
                            .attr("class","t"+sessionObject.trial+"-s"+sessionObject.subject);
                }
        
            }
            currentY+=90
            if (fnirsSessionsSvg.attr("height")<=currentY+200){
                fnirsSessionsGroup.attr("height",currentY+200)
                fnirsSessionsSvg.attr("height",currentY+250+margins.fnirsSessions.top+margins.fnirsSessions.bottom)     
            }
        })
        currentY+=50
        if (fnirsSessionsSvg.attr("height")<=currentY+200){
            fnirsSessionsGroup.attr("height",currentY+200)
            fnirsSessionsSvg.attr("height",currentY+250+margins.fnirsSessions.top+margins.fnirsSessions.bottom)   
        }
    })
}



export function updateMatrix(){
    matrixGroup.selectAll('*').remove();
    let filteredObjects = []
    selectedItems.forEach((item)=>{
        let tempObject = dataFiles[2].filter(obj => obj.subject == item.subject && obj.trial == item.trial);
        if (tempObject.length==0){
            console.log("ERROR: NO MATCH FOUND FOR SUBJECT AND TRIAL ID")
            tempObject= [{subject: item.subject, trial: item.trial, missing:true}]
        }
        
        else
            tempObject[0]["missing"]=false
        filteredObjects.push(tempObject[0]) 
    })
    
    let stepsToKeep = ["a","b","c","d","e","f"]
    const valuesByStep = stepsToKeep.map(step =>
        filteredObjects.map(obj => obj[step]).filter(value => value !== undefined)
    );

    const minValuesByStep = valuesByStep.map(values => d3.min(values));
    
    const maxValuesByStep = valuesByStep.map(values => d3.max(values));

    let nullIndices = [];
    minValuesByStep.forEach((element, index) => {
        if (element == null) {
            nullIndices.push(index);
        }
    });
    
    const stepsPresent = stepsToKeep.filter((value, index) => !nullIndices.includes(index));
        
    const xScaleMatrix = d3.scaleBand()
        .domain(stepsPresent)
        .range([0,  d3.select("#matrix-container").node().clientWidth -margins.matrix.left - margins.matrix.right ])
        .padding(0.1);


    const xAxis = d3.axisTop(xScaleMatrix);

    // Append axes to SVG
    matrixGroup.append('g')
        .attr('class', 'x-axis axisHide')
        .attr('transform', `translate(0, 10)`)
        .call(xAxis);
    
    stepsPresent.forEach((step)=>{
        
        matrixGroup.append('rect')
            .attr("x",xScaleMatrix(step)+ xScaleMatrix.bandwidth()*0.24)
            .attr("y",-7)
            .attr("fill",stepColorScale(step))
            .attr("width",10)
            .attr("height",10)
    })

    const maxRadius = xScaleMatrix.bandwidth()/2;
    
    // Calculate min and max total values across all steps and objects
    const minTotal = d3.min(minValuesByStep);
    const maxTotal = d3.max(maxValuesByStep);
    
    const radiusScale = d3.scaleLinear()
        .domain([minTotal, maxTotal])
        .range([8,maxRadius]); 

    let currentY = margins.matrix.top; 
    
    let groupArray = uniqueSubjects
    if(selectedGroupby=="trial")
        groupArray = uniqueTrials

    groupArray.forEach((id)=>{
        let groupedObj = filteredObjects.filter(obj => obj.subject == id)
        if (selectedGroupby=="trial")
            groupedObj = filteredObjects.filter(obj => obj.trial == id)
        if (groupedObj.length==0)
            return
        currentY +=20;
        groupedObj.forEach((session)=>{
            if (session.missing){
                let displayMissing= `Missing info for Subject:${session.subject} Trial:${session.trial}`
                let missingText = matrixGroup.append("text").attr("x", xScaleMatrix.range()[1]/2).attr("y", currentY+28).text(displayMissing).style("font-size", "11px").attr("text-anchor","middle").style("fill","black").style("fill-opacity", 0.5)
                let bbox = missingText.node().getBBox();
                
                matrixGroup.append("rect")
                    .attr("x", bbox.x - 2)
                    .attr("y", bbox.y - 2)
                    .attr("width", bbox.width + 4)
                    .attr("rx",5)
                    .attr("ry",5)
                    .attr("height", bbox.height + 4)
                    .style("fill", "none")
                    .style("stroke-opacity", 0.5)
                    .attr("stroke", "black");

                if(matrixSvg.attr("height")<=currentY+200){
                    matrixGroup.attr("height",currentY+200)
                    matrixSvg.attr("height",currentY+250+margins.matrix.top+margins.matrix.bottom)     
                }
                currentY+=90;
                return
            }
                        
            stepsPresent.forEach(step => createPie( session, step));

            currentY+=90;
        })
        currentY+=50
        if(matrixSvg.attr("height")<=currentY+200){
            matrixGroup.attr("height",currentY+200)
            matrixSvg.attr("height",currentY+250+margins.matrix.top+margins.matrix.bottom)     
        } 
    })    

    function createPie(row, step) {
        let overloadCorr, optimalCorr, underloadCorr;
        if (dataFiles[8].procedure_correlations[row.subject][row.trial] && dataFiles[8].procedure_correlations[row.subject][row.trial][step]){
            overloadCorr =  dataFiles[8].procedure_correlations[row.subject][row.trial][step][selectedFnirs+"_Overload"]
            optimalCorr  = dataFiles[8].procedure_correlations[row.subject][row.trial][step][selectedFnirs+"_Optimal"]
            underloadCorr = dataFiles[8].procedure_correlations[row.subject][row.trial][step][selectedFnirs+"_Underload"] 
        }
        const total = row[step] ?? 0;
        const none = row[step + "_None"] ?? 0;
        const error = row[step + "_error"] ?? 0;
        if (total==0)
            return
        else if (error==0 || none==0){
            matrixGroup.append('circle')
                .attr('cx', xScaleMatrix(step)+maxRadius)
                .attr("class", "circle circle-" + step + "-"+row.subject +"-"+row.trial)
                .attr('cy', currentY + 30)
                .attr('r', radiusScale(total))
                .attr('fill', ()=> error==0? "#AEAEAE" : "black")
                .on("mouseover", function(d) {
                    console.log(d)
                    matrixTooltip.transition()
                        .duration(200)
                        .style("visibility", "visible")
                        matrixTooltip.html(`<strong>${ selectedFnirs.charAt(0).toUpperCase() + selectedFnirs.slice(1)} Error Contribution </strong><br> Overload: ${overloadCorr} <br> Optimal: ${optimalCorr} <br> Underload: ${underloadCorr}`)
                        .style("left", (d.clientX + 10) + "px")
                        .style("top", (d.clientY - 28) + "px");
                })
                .on("mouseout", function(d) {
                    matrixTooltip.transition()
                        .duration(500)
                        .style("visibility", "hidden");
                });

            return
        }
        const radius = radiusScale(total); // Scale the radius according to the total
    
        const color = d3.scaleOrdinal()
            .domain(["None", "error"])
            .range(["#AEAEAE", "black"]);
    
        const pie = d3.pie()([none, error]);
    
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);
    
        const arcs = matrixGroup.selectAll(".arc-" + step + "-"+row.subject +"-"+row.trial)
            .data(pie)
            .enter()
            .append("g")
            .attr("class", "arc arc-" + step + "-"+row.subject +"-"+row.trial)
            .attr("transform", "translate(" + (xScaleMatrix(step)+maxRadius) + "," + (currentY + 30) + ")");
    
        arcs.append("path")
            .attr("fill", (d, i) => color(i === 0 ? "None" : "error"))
            .attr("d", arc)
            .on("mouseover", function(d) {
                console.log(d)
                matrixTooltip.transition()
                    .duration(200)
                    .style("visibility", "visible");
                    matrixTooltip.html(`<strong>${ selectedFnirs.charAt(0).toUpperCase() + selectedFnirs.slice(1)} Error Contribution </strong><br> Overload: ${overloadCorr} <br> Optimal: ${optimalCorr} <br> Underload: ${underloadCorr}`)
                    .style("left", (d.clientX + 10) + "px")
                    .style("top", (d.clientY - 28) + "px");
            })
            .on("mouseout", function(d) {
                matrixTooltip.transition()
                    .duration(500)
                    .style("visibility", "hidden");
            });
    
        //arcs.append("text")
          //  .attr("transform", d => "translate(" + arc.centroid(d) + ")")
            //.attr("text-anchor", "middle")
            //.attr("fill", "white")
            //.text(d => d.value);
    }
}

export function updateHl2Details(){
    hl2Group.selectAll('*').remove();
    d3.select("#gaze-header")
        .style("visibility","hidden")
    
    d3.select("#imu-header")
        .style("visibility","hidden")

    d3.select("#fnirs-title-header")
        .style("visibility","hidden")

    if (brushedSubject == null){
        videoPlayer.src=""
        videoPlayer.load();
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
        return
    }
    d3.select("#gaze-header")
        .style("visibility","visible")

    d3.select("#imu-header")
        .style("visibility","visible")

    d3.select("#fnirs-title-header")
        .style("visibility","visible")

    let duration = allTimestamps['t'+brushedTrial+"-s"+brushedSubject]

    let xScaleHL2 = d3.scaleLinear()
        .domain([0, duration])
        .range([0,hl2Group.attr("width")])

    hl2Group.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, -5)`)
        .call(d3.axisTop(xScaleHL2)
            .tickValues([0, duration/2, duration])
            .tickFormat(d => Math.round(d/60) + "min"));

    hl2Group.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, 185)`)
        .call(d3.axisTop(xScaleHL2)
            .tickValues([0, duration/2, duration])
            .tickFormat(d => Math.round(d/60) + "min"));
    
    hl2Group.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, 375)`)
        .call(d3.axisTop(xScaleHL2)
        .tickValues([0, duration/2, duration])
        .tickFormat(d => Math.round(d/60) + "min"));



    let xScaleHL2reverse =  d3.scaleLinear()
        .domain([0,hl2Group.attr("width")])
        .range([0, duration])

    let yScaleGaze = d3.scaleLinear()
        .domain([1, -1])
        .range([0, 120])
    
    let maxImu = dataFiles[7].reduce((tempMax, obj) => Math.max(tempMax, obj[selectedImu]), dataFiles[7][0][selectedImu])
    let minImu = dataFiles[7].reduce((tempMin, obj) => Math.min(tempMin, obj[selectedImu]), dataFiles[7][0][selectedImu])

    let yScaleImu = d3.scaleLinear()
        .domain([minImu - ((maxImu-minImu)*0.1) ,maxImu + ((maxImu-minImu)*0.1)])
        .range([120,0])
    
    hl2Group.append('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(-10, 0)`)
        .call(d3.axisLeft(yScaleImu)
            .tickValues([ yScaleImu.domain()[1], (maxImu+minImu)/2, yScaleImu.domain()[0]])
            .tickFormat(d=>Math.round(d)));

    hl2Group.append('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(-10, 190)`)
        .call(d3.axisLeft(yScaleGaze)
            .tickValues([-1,0,1])
            .tickFormat(d=>Math.trunc(d)));

    hl2Group.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("rx",5)
        .attr("ry", 7)
        .attr("width", xScaleHL2.range()[1])
        .attr("height", 120)
        .style("stroke", "black")
        .style("stroke-width", "0.5px")
        .style("stroke-opacity", 0.7)
        .style("fill", "none")
        .style("fill-opacity", 0)

    hl2Group.append("rect")
        .attr("x", 0)
        .attr("y", 190)
        .attr("rx",5)
        .attr("ry", 7)
        .attr("width", xScaleHL2.range()[1])
        .attr("height", 120)
        .style("stroke", "black")
        .style("stroke-width", "0.5px")
        .style("stroke-opacity", 0.7)
        .style("fill", "none")
        .style("fill-opacity", 0)

    /*
    hl2Group.append("rect")
        .attr("x", 0)
        .attr("y", 360)
        .attr("rx",5)
        .attr("ry", 7)
        .attr("width", xScaleHL2.range()[1])
        .attr("height", 120)
        .style("stroke", "black")
        .style("stroke-width", "0.5px")
        .style("stroke-opacity", 0.7)
        .style("fill", "none")
        .style("fill-opacity", 0)
    */
    // Draw a dashed vertical line
    hl2Group.append("line")
        .attr("class","seekline")
        .attr("x1", xScaleHL2(videoPlayer.currentTime)) 
        .attr("y1", 0) 
        .attr("x2",  xScaleHL2(videoPlayer.currentTime)) 
        .attr("y2", 120) 
        .style("stroke", "black")
        .attr("stroke-width", 2)
        .style("stroke-dasharray", "5,5");

    hl2Group.append("line")
        .attr("class","seekline")
        .attr("x1", xScaleHL2(videoPlayer.currentTime)) 
        .attr("y1", 190) 
        .attr("x2",  xScaleHL2(videoPlayer.currentTime)) 
        .attr("y2", 310) 
        .style("stroke", "black")
        .attr("stroke-width", 2)
        .style("stroke-dasharray", "5,5");

    let imubrush = d3.brushX()
        .extent([[0, 0], [ xScaleHL2.range()[1] , 120]])
        .on("end", hl2brushend);

    let gazebrush = d3.brushX()
        .extent([[0, 190], [ xScaleHL2.range()[1] , 310]])
        .on("end", hl2brushend);
    
    let fnirsbrush = d3.brushX()
        .extent([[0, 380], [ xScaleHL2.range()[1] , 415]])
        .on("end", hl2brushend);

    hl2Group.append("path")
        .datum(dataFiles[7].filter(obj => obj.subject_id == brushedSubject && obj.trial_id == brushedTrial && obj.seconds <= duration))
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1)    
        .attr("stroke-opacity", 0.8)
        .attr("d", d3.line()
        .x(function(d) { return xScaleHL2(d.seconds) })
        .y(function(d) { return yScaleImu(d[selectedImu]) }))

    hl2Group.append("path")
        .datum(dataFiles[6].filter(obj => obj.subject_id == brushedSubject && obj.trial_id == brushedTrial && obj.seconds <= duration))
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1)    
        .attr("stroke-opacity", 0.8)
        .attr("d", d3.line()
        .x(function(d) { return xScaleHL2(d.seconds) })
        .y(function(d) { return 190 + yScaleGaze(d[selectedGaze]) }))
    
    let filteredFnirs = dataFiles[3].filter(obj => obj.subject_id == brushedSubject && obj.trial_id == brushedTrial)
    
    if (filteredFnirs.length==1){

        let fnirsToDisplay = filteredFnirs[0]
        
        fnirsToDisplay.consolidatedFNIRS[selectedFnirs].forEach(data => {
            hl2Group.append("rect")
                .attr("x", xScaleHL2(data.startTimestamp))
                .attr("y", 380)
                .attr("width", xScaleHL2(data.endTimestamp) - xScaleHL2(data.startTimestamp)) 
                .attr("height", 35)
                .style("fill", () => {return data.value == "Underload" ? "#ffb0b0" : data.value == "Overload" ? "#99070d" : "#eb5a4d";});
        });
        /*
        let variableName= selectedFnirs + "_confidence" 
        let yScaleLine =  d3.scaleLinear()
        .domain([1.0,0])
        .range([320,405])

        hl2Group.append("path")
            .datum(fnirsToDisplay.data.filter(function(d) { return d.seconds >= 0 && d.seconds<=duration }))
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.8)
            .attr("d", d3.line()
            .x(function(d) { return xScaleHL2(d.seconds) })
            .y(function(d) { return yScaleLine(d[variableName]) }))  
            */
    }
    
    let gazeBrushGroup = hl2Group.append("g")
        .attr("class", "brush gazebrush")
        .call(gazebrush, [ xScaleHL2.range()[0],xScaleHL2.range()[1]]);

    let imuBrushGroup = hl2Group.append("g")
        .attr("class", "brush imubrush")
        .call(imubrush);

    let fnirsBrushGroup = hl2Group.append("g")
        .attr("class", "brush fnirsbrush")
        .call(fnirsbrush);

    gazeBrushGroup.call(gazebrush.move, [ xScaleHL2(vidStart),xScaleHL2(vidEnd)]);
    imuBrushGroup.call(imubrush.move, [ xScaleHL2(vidStart),xScaleHL2(vidEnd)]);
    fnirsBrushGroup.call(fnirsbrush.move, [ xScaleHL2(vidStart),xScaleHL2(vidEnd)]);
    
    let timeupdate=0
    videoPlayer.addEventListener('timeupdate', function() {
        let curTime = videoPlayer.currentTime
        d3.selectAll(".seekline")
            .attr("x1",xScaleHL2(curTime))
            .attr("x2",xScaleHL2(curTime))
        if (videoPlayer.currentTime >= vidEnd) {
          // Loop back to the start time
          videoPlayer.currentTime = vidStart;
        }

        else if ( videoPlayer.currentTime<vidStart && timeupdate>5){
            videoPlayer.currentTime = vidStart;
            timeupdate=0

        }
        timeupdate+=1 
      });

    function hl2brushend(e){
        if (typeof e.sourceEvent != 'undefined') {          
            let newt1 = xScaleHL2reverse(e.selection[0])  
            let newt2 = xScaleHL2reverse(e.selection[1])
            let allBrushes = eventTimelineGroup.selectAll(".timelinebrush").nodes()
            allBrushes.forEach((eachBrush)=>{
                let className = "brush-t"+brushedTrial+"-s"+brushedSubject
                if (d3.select(eachBrush).classed(className)){
                    let curBrush = d3.select(eachBrush)
                    curBrush.call(brushesAdded[0].move, [xEventTimelineScale(newt1), xEventTimelineScale(newt2)]); 
                }
            })    
        }

    }
}


  
