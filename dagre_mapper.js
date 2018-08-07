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
      live_graph = new Object(),
      checked = new Object(),
      link_dict = new Object(),
      relations = new Object(),
      added = new Object(),
      deleted = new Object(),
      state = 1,
      results = {"desc":{}, "anc":{}},
      root;

  var diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

  // define the zoomListener which calls the zoom function on the "zoom"
  // event constrained within the scaleExtents
  var zoomListener = d3.behavior.zoom().on("zoom", function () {
    svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
  });


  var svg = d3.select("#Drawing_board").append("svg")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
      .attr("overflow", 'visible')
      .call(zoomListener);

  svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  d3.json("http://127.0.0.1:5002/api/table", function(error, tables) {
    if (error) throw error;
    console.log("entered")

    console.log("tables", tables)

    for (key in tables){
      var table_name = key.split(".")[2]
      root_table[table_name] = new Object()
      var rows = tables[key]
      var columns = rows[0].column
      root_table[table_name].columns = columns
      rows = rows.slice(1)

      for (row in rows){
        row = rows[row]
        var name = row.name
        root_row = new Object()
        root_row.name = name
        root_row.data = row.val
        root_table[table_name][name] = root_row
      }
    }
    d3.json("http://127.0.0.1:5002/api/graph", function(error, t_graph) {
      if (error) throw error;
      console.log(t_graph)
      for (key in t_graph){
        if (Object.keys(root_table).includes(key)){
          table_graph[key] = new Object()
          relations[key] = new Object()
          table_graph[key].name = key
          table_graph[key].children = Object.keys(t_graph[key]).filter(x => Object.keys(root_table).includes(x))
        }
      }

      for (key in relations){
        for (other in t_graph[key]){
          if (Object.keys(root_table).includes(other)){
            for (join in t_graph[key][other]){
              var column = t_graph[key][other][join][0].toLowerCase()
              if (Object.keys(relations[key]).includes(column)){
                relations[key][column].push([other, t_graph[key][other][join][1].toLowerCase()])
              } else {
                relations[key][column] = [[other, t_graph[key][other][join][1].toLowerCase()]]
              }
            }
          }
        }
      }

      console.log("r", relations)
      d3.json("http://127.0.0.1:5002/api/live", function(error, l_graph) {
        if (error) throw error;

        for (key in l_graph){
          table_name = key.split(".")[2]
          live_graph[table_name] = l_graph[key].map(x=>x.toString())
        }

        console.log("live", live_graph)
        console.log(table_graph)
        console.log("root", root_table, Object.keys(root_table).length)

        draw()
      });
    });
  });

  // d3.select(self.frameElement).style("height", "800px");

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

    var empty_nodes = graph.nodes().filter(v => Object.keys(root_table[graph.node(v).name]).length == 1)
    empty_nodes.forEach(function(v){graph.removeNode(v)})
    console.log(empty_nodes.length)
    var isolates = graph.nodes().filter(v => graph.neighbors(v).length == 0)
    isolates.forEach(function(v){graph.removeNode(v)})

    console.log(graph.nodes().length)

    fuzzyAutocomplete($( "#tags" ), graph.nodes().map(v => graph.node(v).name));

    $("#tags").keypress(function(e) {
        var keycode = (e.keyCode ? e.keyCode : e.which);
        if (keycode == '13') {
          var txt = $("#tags").val()
          console.log($("#"+txt))
          if (Object.keys(table_graph).includes(txt)){

            $("#"+txt + "> circle").addClass("highlighted")
            setTimeout(function(){
                $("#"+txt + "> circle").removeClass("highlighted")
            }, 2600);
          }
        }
    });


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
        .attr("id", function(d){return d.name})
        .attr("class", "node")
        .attr("transform", function(d) {
          return "translate(" + d.y + "," + d.x + ")"; });

    nodeEnter.forEach(function(d){$(d).on("click", function(event){
      click(event.currentTarget.__data__)
    })});;

    nodeEnter.append("circle")
        .attr("r", 4.5)
        .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    // Update the links…
    var link = svg.selectAll("path.link")
        .data(graph.edges().map(function(e){return graph.edge(e)}), function(d) { return [d.source.id, d.target.id]; });


    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
        .attr("id", function(d){return d.id})
        .attr("class", "link")
        .attr("d", diagonal);

    $(".link").each(function(i, d){
      var source_name = d.__data__.source.name
      var target_name = d.__data__.target.name
      if (Object.keys(link_dict).includes(source_name)){
        link_dict[source_name][target_name] = d
      } else{
        link_dict[source_name] = new Object()
        link_dict[source_name][target_name] = d
      }
    })

    nodeEnter.append("text")
        .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
        .text(function(d) { return d.name; })
        .style("fill-opacity", 1);

    click({name: "Portfolios"})
  }

  function click(d) {
    var val = []
    $('.tab[filter_on=true]').each(function(i){
      val[i] = $(this).attr("value");
    });
    var prev_table = $('#Source-table').html()
    checked[prev_table] = val


    console.log("checked", checked)
    console.log(d)
    console.log(root_table[d.name])

    $('#Source-table').text(d.name)
    $('#Source-list').empty()

    var rows = Object.keys(root_table[d.name]).filter(x=> x != 'columns') || []
    console.log(rows.length);
    var active = results["Model_Interface.dbo." + d.name] || []
    active = active.map(x => String(x))
    var filters = checked[d.name] || []

    var live_nodes = live_graph[d.name]

    rows.sort()
    active.sort()
    filters.sort()

    var inactive_filters = filters.filter(value => -1 == active.indexOf(value));
    rows_to_highlight = active.concat(inactive_filters)
    rows = rows.filter(x => -1 == rows_to_highlight.indexOf(x))
    rows = rows_to_highlight.concat(rows)

    console.log("rows", rows)

    for (key in rows){
      var btn = $('<div class="tab" value="' + rows[key] + '" filter_on=false>'+rows[key]+'</div>')
      if (live_nodes.includes(rows[key])){
        btn.addClass("live")
      }
      btn.click(function(e){
        elem = $(e.target)
        var state = elem.attr("filter_on")
        if (state === 'true'){
          elem.removeClass("filter")
          elem.attr("filter_on", false)
        } else {
          elem.addClass("filter")
          elem.attr("filter_on", true)
        }
      })
      btn.hover(function(d){
        $(d.target).css("background-color", "lightgreen")
        populate($(d.target).html())
      }, function(d){
        $(d.target).css("background-color", "")
        console.log("Exited")
      })
      $('#Source-list').append(btn)
    }

    for (value in filters){
      elem = $(".tab[value='" + filters[value] + "']")
      elem.attr("filter_on", true)
      elem.addClass("filter")
    }

    for (value in active){
      elem = $(".tab[value='" + active[value] + "']")
      elem.addClass("active")
    }

  }

  function sql_click(d){
    $('#Source-table').text(d.name)
    $('#Source-list').empty()

    var live_rows = live_graph[d.name].filter(x=> x != 'columns') || []
    console.log(live_rows.length);
    var new_live = added["Model_Interface.dbo." + d.name] || []
    new_live = new_live.map(x => String(x))
    var new_dead = deleted["Model_Interface.dbo." + d.name] || []
    new_dead = new_dead.map(x => String(x))
    console.log(new_dead, new_live)

    live_rows.sort()
    new_live.sort()
    new_dead.sort()

    var always_live = live_rows.filter(value => -1 == new_dead.indexOf(value));
    var all_rows = new_live.concat(new_dead.concat(always_live))

    console.log(all_rows)

    for (key in all_rows){
      var btn = $('<div class="tab live" value="' + all_rows[key] + '">'+all_rows[key]+'</div>')
      btn.hover(function(d){
        $(d.target).css("background-color", "yellow")
        populate($(d.target).html())
      }, function(d){
        $(d.target).css("background-color", "")
        console.log("Exited")
      })
      $('#Source-list').append(btn)
    }

    for (value in new_live){
      elem = $(".tab[value='" + new_live[value] + "']")
      elem.removeClass("live")
      elem.addClass("new_live")
    }

    for (value in new_dead){
      elem = $(".tab[value='" + new_dead[value] + "']")
      elem.removeClass("live")
      elem.addClass("new_dead")
    }
  }

  function modal(table,col){
    console.log(relations[table][col])
  }

  function populate(d){
    var table = root_table[$("#Source-table").html()]
    $('#Target-table').text(d)
    $('#Target-list').empty()
    var rels = relations[$("#Source-table").html()]
    for (val in table[d]['data']){
      var col = table['columns'][val]
      if (Object.keys(rels).includes(col)){
        var Info = '<div class="tab active"> <b>' +  col + " :</b>" + table[d]['data'][val] + "</div>"
        Info = $(Info)
        Info.click(function(){
          modal( $("#Source-table").html(), col)
        })
      } else {
        var Info = '<div class="tab"> <b>' +  col + " :</b>" + table[d]['data'][val] + "</div>"
      }
      $('#Target-list').append($(Info))
    }
  }

  function process_Nodes(){
    var val = []
    $("circle").css("fill",  "#fff")
    $("circle").attr("r", 4.5)
    $('.tab[filter_on=true]').each(function(i){
      val[i] = $(this).attr("value");
    });
    var source_table_name = $('#Source-table').html()
    checked[source_table_name] = val

    url = "http://127.0.0.1:5002/test/"
    var req = new Object();
    req['table'] = Object.keys(checked).filter(x => checked[x].length > 0)
    console.log(checked)
    for (key in checked){
      if (checked[key].length > 0) {
        req[key] = checked[key]
      }
    }

    url = encodeURI(url)
    console.log("URL", url)

    $.post(url, req, function(result) {

        console.log("entered")
        results = result
        console.log("result", result)

        $(".link").css("stroke", "")
        $(".link").css("stroke-width", "")
        // $(".link").hover(function(d){console.log("No")}, function(d){console.log("Nope")})

        for (key in result){
          var table_name = key.split(".")[2]
          node = $("#" + table_name + " > circle")
          if (Object.keys(checked).includes(table_name) && checked[table_name].length > 0){
            node.css("fill", "lightcoral")
            node.attr("r", 5.5)
          } else {
            if (result[key].length > 0){
              node.css("fill", "lightsteelblue")
              node.attr("r", 4.5 + 1*(result[key].length/Object.keys(root_table[table_name]).length))
            }
          }
          if (result[key].length > 0){
            for (target_sname in link_dict[table_name]){
              target_fname = "Model_Interface.dbo." + target_sname
              if (Object.keys(result).includes(target_fname) && result[target_fname].length>0){
                var link_elem = $(link_dict[table_name][target_sname])
                link_elem.css("stroke", "black")
                link_elem.css("stroke-width", "1px")
                // link_elem.hover(function(d){console.log("Hovering")}, function(d){console.log("Stopped")})
              }
            }
          }
        }

        var target_table = $('#Target-table').html()
        click({name: source_table_name})
    })
  }

  $('#Switch').click(function(){
    if (state == 1){
      state = 2
      console.log("SQL")
      $('#SqlInput').css('display', "grid")
      $('#Process').css('display', "None")
      $('.node').click(function(event){
        console.log(event)
        sql_click(event.currentTarget.__data__)
      })
      $('#Leg_1').css('background-color', 'lightgreen')
      $('#Leg_2').css('background-color', 'plum')
      $('#leg_1_t').html("Added")
      $('#leg_2_t').html("Deleted")
      $("circle").css("fill",  "#fff")
      $("circle").attr("r", 4.5)
      $('.link').css("stroke", "")
      $('.link').css("stroke-width", "")
      $('#Switch').val("Switch to filtering")
      sql_click({name: "Portfolios"})
    } else {
      state = 1
      console.log("NoSQL")
      $('#SqlInput').css('display', "")
      $('#Process').css('display', "")
      $('.node').click(function(event){
        console.log(event)
        click(event.currentTarget.__data__)
      })
      $('#Leg_1').css('background-color', '')
      $('#Leg_2').css('background-color', '')
      $('#leg_1_t').html("Active")
      $('#leg_2_t').html("Filter")
      $("circle").css("fill",  "#fff")
      $("circle").attr("r", 4.5)
      $('.link').css("stroke", "")
      $('.link').css("stroke-width", "")
      $('#Switch').val("Switch to SQL")
      click({name: "Portfolios"})
    }
  })

  $('#Process').click(function(){
       process_Nodes();
    });

  $('#sql_processor').click(function(){
    url = "http://127.0.0.1:5002/sql_queries/"
    var text = $("#myText").val();
    var req = $.parseJSON(text)
    req["table"] = Object.keys(req)
    console.log(req)

    url = encodeURI(url)
    console.log("URL", url)

    $.post(url, req, function(result) {
      console.log(result)

      added = result["add"]
      deleted = result["delete"]

      for (key in result["add"]){
        var table_name = key.split(".")[2]
        node = $("#" + table_name + " > circle")

        node.css("fill", "lightgreen")
        node.attr("r", 5.5)


        for (target_sname in link_dict[table_name]){
          target_fname = "Model_Interface.dbo." + target_sname
          if (Object.keys(result["add"]).includes(target_fname)){
            var link_elem = $(link_dict[table_name][target_sname])
            link_elem.css("stroke", "black")
            link_elem.css("stroke-width", "1px")
          }
          if (Object.keys(result["delete"]).includes(target_fname)){
            var link_elem = $(link_dict[table_name][target_sname])
            link_elem.css("stroke", "black")
            link_elem.css("stroke-width", "1px")
          }
        }
      }

      for (key in result["delete"]){
        var table_name = key.split(".")[2]
        node = $("#" + table_name + " > circle")

        node.css("fill", "plum")
        node.attr("r", 5.5)


        for (target_sname in link_dict[table_name]){
          target_fname = "Model_Interface.dbo." + target_sname
          if (Object.keys(result["add"]).includes(target_fname)){
            var link_elem = $(link_dict[table_name][target_sname])
            link_elem.css("stroke", "black")
            link_elem.css("stroke-width", "1px")
          }
          if (Object.keys(result["delete"]).includes(target_fname)){
            var link_elem = $(link_dict[table_name][target_sname])
            link_elem.css("stroke", "black")
            link_elem.css("stroke-width", "1px")
          }
        }
      }

      var source_table_name = $('#Source-table').html()
      sql_click({name: source_table_name})

      console.log(added, deleted)
    })
  })
});
