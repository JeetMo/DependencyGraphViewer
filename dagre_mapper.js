$(document).ready(function(){

  var margin = {top: 20, right: 120, bottom: 20, left: 120},
      width = 960 - margin.right - margin.left,
      height = 800 - margin.top - margin.bottom;

  var i = 0,
      duration = 750,
      root;

  var root_table = new Object()
  var table_graph = new Object()

  var tree = d3.layout.tree()
      .size([height, width]);

  var diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

  function zoom() {
      svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
  }


  // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
  var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);


  var svg = d3.select("body").append("svg")
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
        root_row.name = key + " " + name
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

    d3.json("http://127.0.0.1:5000/api/results", function(error, flare) {
      if (error) throw error;

      console.log("root", flare)
      var root_children = flare['children'].map(x => root_table[x[0]][x[1]])
      root = {'name': "Portfolios", 'children': root_children}
      // table_graph['Portfolios'] = {name:'Portfolios', children: ['table_t1']}

      root.x0 = height / 2;
      root.y0 = 0;

      function collapse(d) {
        if (d.children) {
          d._children = d.children;
          d._children.forEach(collapse);
          d.children = null;
        }
      }

      root.children.forEach(collapse);
      update(root);
    });

    console.log(table_graph)
  });


  d3.select(self.frameElement).style("height", "800px");

  function update(source) {

    var graph = new dagre.graphlib.Graph();


    // Compute the new tree layout.
    var nodes = tree.nodes(root); //.reverse(),

    Object.keys(table_graph).forEach(function(d){graph.setNode(d, table_graph[d])})

    graph.setGraph({});
    graph.setDefaultEdgeLabel(function() { return {}; });

    // for (key in nodes){
    //   for (child in nodes[key].children){
    //       graph.setEdge(nodes[key].name, nodes[key].children[child].name, {"source": nodes[key], "target":nodes[key].children[child]})
    //   }
    // }

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
    nodes.forEach(function(d) { d.y = d.depth * 180; });
    // Update the nodes…
    graph.nodes().forEach(function(v){console.log(graph.node(v)); graph.node(v).x = graph.node(v).x/3})


    var node = svg.selectAll("g.node")
        .data(graph.nodes().map(function(v){return graph.node(v)}), function(d) { return d.id || (d.id = ++i); });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", "translate(" + source.y0 + "," + source.x0 + ")")
        .on("click", click);

    nodeEnter.append("circle")
        .attr("r", 1e-6)
        .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeEnter.append("text")
        .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
        .text(function(d) { return d.name; })
        .style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    var nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", function(d) {
          return "translate(" + d.y + "," + d.x + ")"; });

    nodeUpdate.select("circle")
        .attr("r", 4.5)
        .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeUpdate.select("text")
        .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
        .remove();

    nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);

    // Update the links…
    var link = svg.selectAll("path.link")
        .data(graph.edges().map(function(e){return graph.edge(e)}), function(d) { return [d.source.id, d.target.id]; });

    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", function(d) {
          var o = {x: source.x0, y: source.y0};
          return diagonal({source: o, target: o});
        });

    // Transition links to their new position.
    link.transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
          var o = {x: source.x, y: source.y};
          return diagonal({source: o, target: o});
        })
        .remove();

    // Stash the old positions for transition.
    graph.nodes().forEach(function(d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Toggle children on click.
  function click(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    update(d);
  }

  // Returns a list of all nodes under the root.
  function flatten(root) {
    var nodes = [], i = 0;

    function recurse(node) {
      if (node.children) node.children.forEach(recurse);
      if (!node.id) node.id = ++i;
      nodes.push(node);
    }

    recurse(root);
    return nodes;
  }
});
