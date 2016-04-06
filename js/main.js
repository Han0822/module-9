window.onload = setMap();

function setMap() {
	var width = window.innerWidth *0.8, height = 850;

	var map = d3.select("body")
		.append("svg")
		.attr("class", "map")
		.attr("width", width)
		.attr("height", height);

	var projection = d3.geo.albers()
		.center([0, 36.33])
		.rotate([-105, 0, 0])
		.parallels([30, 46])
		.scale(950)
		.translate([width / 2, height / 2]);

	var path = d3.geo.path()
		.projection(projection);

	queue()
		.defer(d3.csv, "data/tour.csv")
		.defer(d3.json, "data/ChinaProvinces.topojson")
		.defer(d3.json, "data/AsiaRegion_6simplified.topojson")
		.await(callback); 

	function callback(error, pop, prov, asia) {
		// second parameter need to inspect element and find objects
		var asiaRegion = topojson.feature(asia, asia.objects.AsiaRegion);
		var provinces = topojson.feature(prov, prov.objects.collection).features;
		// new provinces with added attributes joined
		provinces = joinData(provinces, pop);
		setGraticule(map, path);

        var backgroundCountry = map.append("path")
        	.datum(asiaRegion)
        	.attr("class", "backgroundCountry")
        	.attr("d", path);

        var colorScale = makeColorScale(pop);
		
		setEnumUnits(provinces, map, path, colorScale);

		setChart(pop, colorScale);

	};
};

function setGraticule(map, path) {
		// svg elements drawing order is determined by the order they were added to DOM
	var graticule = d3.geo.graticule()
        .step([10, 10]); //place graticule lines every 10 degrees of longitude and latitude

    var gratBackground = map.append("path")
    	.datum(graticule.outline())
    	.attr("class", "gratBackground")
    	.attr("d", path);

    // create graticule lines  
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(provinces, pop) {
	// join attributes from csv to geojson.
	var attrArray = ["name","2000","2009"];
	for (var i = 0; i < pop.length; i++) {
		var csvProv = pop[i];
		var csvKey = csvProv.name;

		for (var a = 0; a < provinces.length; a++) {
			var jsonProps = provinces[a].properties;
			var jsonKey = jsonProps.name;

			if (jsonKey == csvKey) {
				attrArray.forEach(function(attr){
					var val = parseFloat(csvProv[attr]);
					jsonProps[attr] = val;
				})
			};
		};
	};

	return provinces;
};

function setEnumUnits(provinces, map, path, colorScale) {
		// select all must take a list, should be a list of features, not the whole feature collection
	var enumUnits = map.selectAll(".provinces")
		.data(provinces)
		.enter()
		.append("path")
		.attr("class", "enumUnits")
		.attr("id", function(d) {
			return d.properties.name;
		})
		.attr("d", path)
		.style("fill", function(d){
			return choropleth(d.properties, colorScale);
		});
};

function makeColorScale(data) {
	console.log(data);
    var colorClasses = [
        "#fee5d9",
	    "#fcae91",
	    "#fb6a4a",
	    "#de2d26",
	    "#a50f15"
    ];

    var colorScale = d3.scale.threshold()
    	.range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i = 0; i < data.length; i++){
        var val = parseFloat(data[i]["2009"]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale; 
}

// deal with enumUnits without data
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props["2009"]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (val && val != NaN){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};




function setChart(pop, colorScale) {
	var chartWidth = window.innerWidth * 0.5,
		chartHeight = 500,
	    leftPadding = 10,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

	var chart = d3.select("body")
		.append("svg")
		.attr("width", chartWidth)
		.attr("height", chartHeight)
		.attr("class", "chart");

    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

	// yscale to generate the height of each bar based on attribute value
	var yScale = d3.scale.linear()
		.range([0,chartHeight ])
		.domain([400, 40367])

	var bars = chart.selectAll(".bars")
		.data(pop)
		.enter()
		.append("rect")
		.sort(function(a,b){
			return a["2009"]- b["2009"] ;
		})
		.attr("class", function(d){
			return "bars " + d.name;
		})
		.attr("width", chartInnerWidth / pop.length - 1)
		.attr("x", function(d, i){
			return i * (chartInnerWidth / pop.length) + leftPadding;
		})
		.attr("height", function(d){
			return yScale(parseFloat(d["2009"]));
		})
		.attr("y", function(d){
			return chartHeight - yScale(parseFloat(d["2009"])) - topBottomPadding;
		})
		.style("fill", function(d){
			return choropleth(d, colorScale);
		})
		//addNumbersToChart(chart, pop, chartWidth, chartHeight, yScale);


	var chartTitle = chart.append("text")
		.attr("x", 20)
		.attr("y", 40)
		.attr("class", "chartTitle")
		.text("GDP of 2009 in each region");

	var yAxis = d3.svg.axis()
		.scale(yScale)
		.orient("right");

	var axis = chart.append("g")
		.attr("class", "axis")
		.attr("transform", translate)
		.call(yAxis);

	var chartFrame = chart.append("rect")
		.attr("class", "chartFrame")
		.attr("width", chartInnerWidth)
		.attr("height", chartInnerHeight)
		.attr("transform", translate);
};

function addNumbersToChart(chart, pop, chartWidth, chartHeight, yScale){
	// annotate each bar in the chart
	var numbers = chart.selectAll(".numbers")
		.data(pop)
		.enter()
		.append("text")
		.sort(function(a,b){
			return a["2009"]- b["2009"];
		})
		.attr("class", function(d){
			return "numbers " + d.name;
		})
		.attr("text-anchor", "middle")
		.attr("x", function(d, i){
			var fraction = chartWidth / pop.length;
			return i * fraction + (fraction - 1) / 2;
		})
		.attr("y", function(d){
			return chartHeight - yScale(parseFloat(d["2009"])) -15;
		})
		.text(function(d){
			return d["2009"];
		});
}
