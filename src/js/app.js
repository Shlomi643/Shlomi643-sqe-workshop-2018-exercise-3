import $ from 'jquery';
import {mainParser} from './code-analyzer';
let vis = require('vis');

const makeGraph = (old, all, con, alt) => {
    let data = {
        nodes: new vis.DataSet(old),
        edges: new vis.DataSet(all.concat(con).concat(alt))
    };
    new vis.Network(document.getElementById('network'), data, {hierarchical: true});
};

const makeEdges = (data, lbl) => {
    let edges = [];
    for (let i = 0; i < data.length; i++)
        edges.push({from: data[i][0], to: data[i][1], label: lbl, color: 'black', arrows: 'to', smooth: true});
    return edges;
};

$(document).ready(function () {
    $('#goBtn').click(() => {
        let codeToParse = $('#codeHolder').val();
        let inputVectorString = $('#argsHolder').val();
        let curr = mainParser(codeToParse, JSON.parse(inputVectorString));
        // $('#text').val(JSON.stringify(curr));
        makeGraph(curr.nodes, makeEdges(curr.always, ''),
            makeEdges(curr.con, 'T'), makeEdges(curr.alt, 'F'));
    });
});

