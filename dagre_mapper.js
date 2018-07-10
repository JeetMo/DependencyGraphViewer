$(document).ready(function(){

  var margin = {top: 20, right: 120, bottom: 20, left: 120},
      width = 1000 - margin.right - margin.left,
      height = 1000 - margin.top - margin.bottom;

  var i = 0,
      offset_y = 150,
      offset_x = 20,
      duration = 750,
      root_table = new Object(),
      table_graph = new Object(),
      results = new Object(),
      root;

  var diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

  function zoom() {
      svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
  }
  // define the zoomListener which calls the zoom function on the "zoom"
  // event constrained within the scaleExtents
  var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);


  var svg = d3.select("#Drawing_board").append("svg")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
      .attr("overflow", 'visible')
      .call(zoomListener);

  svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  d3.json("http://127.0.0.1:5000/api/table", function(error, tables) {
    if (error) throw error;
    console.log("entered")

    console.log("tables", tables)

    for (key in tables){
      root_table[key] = new Object()

      for (row in tables[key]){
        row = tables[key][row]
        var name = row.name
        root_row = new Object()
        root_row.name = name
        root_row.children = []
        root_table[key][name] = root_row
      }
    }

    for (key in tables){
      children_tables = new Set()
      for (row in tables[key]){
        row = tables[key][row]
        var children = row['children'].map(x => root_table[x[0]][x[1]])
        var t_child = row['children'].map(x => x[0])
        t_child.forEach(function(d){children_tables.add(d)})
        // children_tables.push(new Set(row['children'].map(x => x[0])))
        if (children.length == 0){
          children = null
        }
        root_table[key][row.name].children = children
      }
      table_graph[key] = {"name": key, "children": [...children_tables]}
    }

    draw()

    console.log(table_graph)
  });

  d3.select(self.frameElement).style("height", "800px");


  function draw() {

    var graph = new dagre.graphlib.Graph();


    Object.keys(table_graph).forEach(function(d){graph.setNode(d, table_graph[d])})

    graph.setGraph({});
    graph.setDefaultEdgeLabel(function() { return {}; });

    for (key in table_graph){
      for (child in table_graph[key].children){
        var t_source = table_graph[key]
        var t_target = table_graph[table_graph[key].children[child]]
        graph.setEdge(t_source.name, t_target.name, {"source": t_source, "target":t_target})
      }
    }

    var isolates = graph.nodes().filter(v => graph.neighbors(v).length == 0)
    isolates.forEach(function(v){graph.removeNode(v)})

    dagre.layout(graph)

    // Normalize for fixed-depth.
    // nodes.forEach(function(d) { d.y = d.depth * 180; });
    // Update the nodes…
    graph.nodes().forEach(function(v){
      graph.node(v).y = graph.node(v).y + offset_y;
      graph.node(v).x = graph.node(v).x/3 + offset_x;
    })

    var node = svg.selectAll("g.node")
        .data(graph.nodes().map(function(v){return graph.node(v)}), function(d) { return d.id || (d.id = ++i); });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) {
          return "translate(" + d.y + "," + d.x + ")"; })
        .on("click", click)
        .on("contextmenu", rclick);

    nodeEnter.append("circle")
        .attr("r", 4.5)
        .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeEnter.append("text")
        .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
        .text(function(d) { return d.name; })
        .style("fill-opacity", 1);

    // Update the links…
    var link = svg.selectAll("path.link")
        .data(graph.edges().map(function(e){return graph.edge(e)}), function(d) { return [d.source.id, d.target.id]; });

    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", diagonal);
  }

  // Toggle children on click.
  function click(d) {
    console.log(root_table[d.name])
    $('#Source-table').text(d.name)
    $('#Source-list').empty()
    for (key in root_table[d.name]){
      row = root_table[d.name][key]
      var btn = $('<div><input type="checkbox" class="chk" value="' + row.name + '"/>'+row.name+'</div>')
      $('#Source-list').append(btn)
    }
  }

  function rclick(d){
    active = results["Model_Interface.dbo." + d.name]
    $('#Target-table').text(d.name)
    $('#Target-list').empty()
    for (key in active){
      row = root_table[d.name][active[key]]
      var btn = $('<div>'+row.name+'</div>')
      $('#Target-list').append(btn)
    }
  }

  function process_Nodes(){
    var val = []
    $(':checkbox:checked').each(function(i){
      val[i] = $(this).val();
    });
    url = "http://127.0.0.1:5000/test/?table="+$('#Source-table').html() + "&row=" + val.join("&row=")
    d3.json(url, function(error, result) {
        if (error) throw error;
        console.log("entered")
        results = result
        console.log("result", result)
    })
  }

  $('#Process').click(function(){
       process_Nodes();
    });
});
