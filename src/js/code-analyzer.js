import * as esprima from 'esprima';
import * as escodegen from 'escodegen';

const parseCode = (codeToParse) =>
    esprima.parseScript(codeToParse, {loc: true});

let GREEN = 'MediumSeaGreen';
let rhombusShape = 'diamond';

const isLiteral = (parsed) =>
    parsed.type === 'Literal' && !isNaN(parsed.value);

const binaryExpressionValueSub = (tree, env) => {
    tree.left = retVal(tree.left, env);
    tree.right = retVal(tree.right, env);
    if (!(isLiteral(tree.left) && isLiteral(tree.right)))
        return tree;
    return {
        'type': 'Literal',
        'value': eval(escodegen.generate(tree)),
        'raw': 'evaluated'
    };
};

let retValMap = {};
retValMap['BinaryExpression'] = binaryExpressionValueSub;
retValMap['Identifier'] = (tree, env) => env[tree.name];
retValMap['Literal'] = (parsedValue) => parsedValue;

const retVal = (parsed, env) =>
    retValMap[parsed.type](parsed, env);

const whileStatementHandler = (tree, env) => {
    retVal(tree.test, env);
    subParsed(tree.body, Object.assign({}, env));
};

const assignmentExpressionHandler = (tree, env) => {
    tree.right = retVal(tree.right, env);
    env[tree.left.name] = tree.right;
};

const expressionStatementHandler = (tree, env) => {
    subParsed(tree.expression, env);
};

const returnStatementHandler = (tree, env) => {
    tree.argument = retVal(tree.argument, env);
};

const ifStatementHandler = (tree, env) => {
    tree.test = retVal(tree.test, env);
    subParsed(tree.consequent, Object.assign({}, env));
    if (tree.alternate !== null)
        subParsed(tree.alternate, Object.assign({}, env));
};

const blockStatementHandler = (tree, env) => {
    subRows(tree.body, env);
};

const emptyFunc = () => {
};

const paramsHandler = (tree, env) =>
    tree.forEach((item) => {
        env[item.name] = {
            'type': 'Identifier',
            'name': item.name
        };
    });

const functionDeclarationHandler = (tree, env) => {
    paramsHandler(tree.params, env);
    subParsed(tree.body, env);
};

const sub = (tree, env) => {
    env = env || {};
    subParsed(tree, env);
    return tree;
};

const subParsed = (tree, env) => {
    typeToSubstitutionMap[tree.type](tree, env);
};

const programHandler = (tree, env) => {
    subRows(tree.body, env);
};

const subRows = (tree, env) => {
    for (let i = 0; i < tree.length; i++)
        subParsed(tree[i], env);
};

const variableDeclarationHandler = (tree, env) => {
    subRows(tree.declarations, env);
};

const variableDeclaratorHandler = (tree, env) => {
    tree.init = retVal(tree.init, env);
    env[tree.id.name] = tree.init;
};

let typeToSubstitutionMap = {
    'Program': programHandler,
    'FunctionDeclaration': functionDeclarationHandler,
    'ReturnStatement': returnStatementHandler,
    'BlockStatement': blockStatementHandler,
    'ExpressionStatement': expressionStatementHandler,
    'AssignmentExpression': assignmentExpressionHandler,
    'WhileStatement': whileStatementHandler,
    'UpdateExpression': emptyFunc,
    'VariableDeclarator': variableDeclaratorHandler,
    'VariableDeclaration': variableDeclarationHandler,
    'IfStatement': ifStatementHandler
};

let collectorMap = {
    'IfStatement': ifHandler,
    'WhileStatement': whileHandler,
    'ReturnStatement': returnHandler
};

const mainParser = (codeToCFG, inputVector) =>
    mainHandler(null, colorTreeWithVector(codeToCFG, inputVector)[0].body[0].body.body,
        0, 1, {nodes: [], always: [], con: [], alt: []});

const mainHandler = (lastNode, body, index, nodeNumber, curAns) =>
    body[index].type in collectorMap ? collectorMap[body[index].type](lastNode, body, index, nodeNumber, curAns) :
        collectHelper(lastNode, body, index, nodeNumber, curAns);

const extractOthers = (body, i) => {
    let arr = [];
    for (i; i < body.length; i++) {
        let curr = body[i];
        if (curr.type in collectorMap)
            break;
        arr.push(curr);
    }
    return [{
        type: 'BlockStatement',
        body: arr,
        generator: false,
        expression: false,
        async: false,
        color: arr[0].color
    }, i];
};

function collectHelper(lastNode, body, index, nodeNumber, currAns) {
    let extracted = extractOthers(body, index);
    index = extracted[1];
    let collectedStatements = extracted[0];
    let curr = createNode(nodeNumber++, collectedStatements, 'box', collectedStatements.color);
    currAns.nodes.push(curr);
    return mainHandler(curr, body, index, nodeNumber, currAns);
}

function createNode(number, nodeText, type, color) {
    if (color === undefined) color = 'white';
    let text = nodeText;
    if (nodeText.type !== undefined) text = process(escodegen.generate(nodeText));
    if (number > 0) text = number + ': ' + text;
    return {id: number, label: text, shape: type, color: {background: color, border: 'black'}};
}

const replace = (str, from, to) =>
    str.split(from).join(to);

function process(text) {
    let ret = replace(text, '\n', '');
    ret = replace(ret, '{', '');
    ret = replace(ret, '}', '');
    ret = replace(ret, 'let', '');
    ret = replace(ret, ';', '\n');
    return ret;
}

function whileHandler(lastNode, body, index, nodeNumber, ret) {
    let emptyNode = createNode(nodeNumber++, 'NULL', 'box', GREEN);
    let statement = body[index++];
    let node = createNode(nodeNumber++, statement.test, rhombusShape, statement.color);
    ret.nodes.push(emptyNode);
    ret.nodes.push(node);
    let whileBodyNode = createNode(nodeNumber++, statement.body, 'box', statement.body.color);
    ret.nodes.push(whileBodyNode);
    ret.always.push([lastNode.id, emptyNode.id]);
    ret.always.push([emptyNode.id, node.id]);
    ret.always.push([whileBodyNode.id, emptyNode.id]);
    ret.con.push([node.id, whileBodyNode.id]);
    ret.alt.push([node.id, nodeNumber]);
    return mainHandler(null, body, index, nodeNumber, ret);
}

function ifHandler(lastNode, body, index, nodeNumber, ret) {
    let emptyNumber = -nodeNumber;
    let emptyNode = createNode(emptyNumber, '', 'ellipse', GREEN);
    ret.nodes.push(emptyNode);
    let statement = body[index++];
    let output = addIfHandler(statement, emptyNode, nodeNumber, ret);
    ret = output[0];
    nodeNumber = output[1];
    ret.always.push([lastNode.id, output[2].id]);
    if (statement.alternate !== null)
        return altHandler(output[2], emptyNode, statement.alternate, body, index, nodeNumber, ret);
    ret.alt.push([output[2].id, emptyNumber]);
    return mainHandler(emptyNode, body, index, nodeNumber, ret);
}

function addIfHandler(ifStatement, empty, nodeNumber, ret) {
    let test = ifStatement.test;
    let testNode = createNode(nodeNumber++, test, rhombusShape, test.color);
    let consNode = createNode(nodeNumber++, ifStatement.consequent, 'box', ifStatement.consequent.color);
    ret.nodes.push(testNode);
    ret.nodes.push(consNode);
    ret.always.push([consNode.id, empty.id]);
    ret.con.push([testNode.id, consNode.id]);
    return [ret, nodeNumber, testNode];
}

function altHandler(last, empty, alt, body, index, nodeNumber, ret) {
    if (alt.type !== 'IfStatement')
        return altHelperHandler(last, empty, alt, body, index, nodeNumber, ret);
    let output = addIfHandler(alt, empty, nodeNumber, ret);
    ret = output[0];
    nodeNumber = output[1];
    let tmp = output[2];
    ret.alt.push([last.id, tmp.id]);
    if (alt.alternate !== null)
        return altHandler(tmp, empty, alt.alternate, body, index, nodeNumber, ret);
    ret.alt.push([tmp.id, empty.id]);
    return mainHandler(empty, body, index, nodeNumber, ret);

}

function altHelperHandler(last, empty, alt, body, index, nodeNumber, ret) {
    let alternateNode = createNode(nodeNumber++, alt, 'box', alt.color);
    ret.nodes.push(alternateNode);
    ret.alt.push([last.id, alternateNode.id]);
    ret.always.push([alternateNode.id, empty.id]);
    return mainHandler(empty, body, index, nodeNumber, ret);
}

function returnHandler(last, body, index, nodeNumber, ret) {
    let returnNode = createNode(nodeNumber, body[index], 'box', body[index].color);
    ret.nodes.push(returnNode);
    if (last !== null)
        ret.always.push([last.id, returnNode.id]);
    return ret;
}

function colorTreeWithVector(code, vector) {
    initVector(vector);
    let originalTree = parseCode(code);
    let newTree = parseCode(code);
    sub(newTree);
    originalTree.body[0] = parseCode(escodegen.generate(originalTree.body[0])).body[0];
    let func = Object.assign({}, parseCode(escodegen.generate(newTree.body[0])).body[0]);
    subParsed(func.body, vector);
    let colored = [[], []];
    handleNodes(func.body.body, originalTree.body[0].body.body, colored);
    updateColoredRowWithFunctionIndex(0, colored);
    return [originalTree, colored];
}

function updateColoredRowWithFunctionIndex(by, coloredRows) {
    let greens = coloredRows[0];
    let reds = coloredRows[1];
    updateRowsWithFunctionIndex(greens, by);
    updateRowsWithFunctionIndex(reds, by);
}

function updateRowsWithFunctionIndex(arr, by) {
    for (let i = 0; i < arr.length; i++)
        arr[i] += by;
}

function initVector(inputVector) {
    Object.keys(inputVector).forEach(function (key) {
        inputVector[key] = {
            'type': 'Literal',
            'value': inputVector[key],
            'raw': inputVector[key]
        };
    });
}

const handleNodesHelper = (currPre, currOri, colored) => {
    eval(escodegen.generate(currPre.test)) ? consColorHandler(currPre, currOri, colored) :
        currPre.alternate !== null && currOri.alternate !== null ? altColorHandler(currPre, currOri, colored) :
            colored[1].push(currOri.loc.start.line);
};

function handleNodes(body, originalBody, colored) {
    for (let i = 0; i < body.length; i++) {
        let currPre = body[i];
        let currOri = originalBody[i];
        if (currPre.type !== 'IfStatement') {
            currOri.color = GREEN;
            colored[0].push(currOri.loc.start.line);
            continue;
        }
        currOri.test.color = GREEN;
        handleNodesHelper(currPre, currOri, colored);
    }
}

function consColorHandler(curr, currOrg, colored) {
    currOrg.consequent.color = GREEN;
    colored[0].push(currOrg.loc.start.line);
    handleNodes(curr.consequent.body, currOrg.consequent.body, colored);
}

const altBodyHandler = (statement) =>
    statement.type === 'BlockStatement' ? statement.body : [statement];

function altColorHandler(curr, currOrg, colored) {
    colored[1].push(currOrg.loc.start.line);
    if (curr.alternate.type === 'BlockStatement') {
        currOrg.alternate.color = GREEN;
        colored[0].push(currOrg.alternate.loc.start.line);
    }
    handleNodes(altBodyHandler(curr.alternate), altBodyHandler(currOrg.alternate), colored);
}

export {mainParser};
