// Original JavaScript code by Chirp Internet: www.chirp.com.au
// Please acknowledge use of this code by including this header.

// modified to :
//  - accept an array of words, phrases
//  - return the amount of matches found

// modified by WeVote to:
//  - stop the recursive search for words at the id weContainer (our menus)
//  - stop at the id noDisplayPageBeforeFraming (the original dom, that becomes dormant and invisible, with a fresh copy in the new iframe)

/* global $ */

function Hilitor (id, tag) {

  var targetNode = document.body;
  var hiliteTag = tag || 'EM';
  var hiliteClassname = 'Highlight';
  var skipTags = new RegExp('^(?:SCRIPT|HEAD|NOSCRIPT|STYLE|TEXTAREA)$');
  var skipClasses = new RegExp('(ui-datepicker)','gi');
  var colors = ['#ff6', '#a0ffff', '#9f9', '#f99', '#f6f'];
  var wordColor = [];
  var colorIdx = 0;
  var matchRegex = '';
  var matchRegexEditable = '';
  var openLeft = false;
  var openRight = false;
  var numberOfHighlights = 0; //added
  var highlights = {}; //added
  var highlightMarkers = {};
  let debugH = false;


  this.setMatchType = function (type) {
    switch (type) {
      case 'left':
        this.openLeft = false;
        this.openRight = true;
        break;
      case 'right':
        this.openLeft = true;
        this.openRight = false;
        break;
      case 'open':
        this.openLeft = this.openRight = true;
        break;
      default:
        this.openLeft = this.openRight = false;
    }
  };

  this.setRegex = function (input) {
    var words = '';
    var wordparts = '';
    var wordsEditable = '';
    var wordpartsEditable = '';
    var wordsList = [];
    var wordpartsList = [];


    //reverse sort the keys based on length
    var sortedKeys = input.sort(function (a, b) {
      return b.word.length - a.word.length;
    });

    // --------------------------
    debugH && console.log('duped sortedKeys.length ' + sortedKeys.length);

    let names = [];
    for (let i = 0; i < sortedKeys.length; i++) {
      const name = sortedKeys[i].word;
      if (name === 'tamara sawyer' || name === 'tami sawyer') {
        debugH && console.log('hilitor  ' + i + ': ' + sortedKeys[i].word);
      }
      if (names.includes(name)) {
        debugH && console.log('Skipping duplicate hilitor name ' + name + ', insert = ' + i);
      } else {
        names.push(name);
      }
    }
    debugH && console.log('deduped name list size ' + names.length);



    // --------------------------

    input.map(function (x){return x.word});

    for (let word in sortedKeys) {
      if (sortedKeys[word].FindWords) {
        words += sortedKeys[word].regex + '|';
        if (sortedKeys[word].ShowInEditableFields) {
          wordsEditable += sortedKeys[word].regex + '|';
        }
      }
      else {
        wordparts += sortedKeys[word].regex + '|';
        if (sortedKeys[word].ShowInEditableFields) {
          wordpartsEditable += sortedKeys[word].regex + '|';
        }
      }

    }
    //regex for all words
    var re = '';
    if (words.length > 1) {
      words = words.substring(0, words.length - 1);
      re += '(' + words + ')';
      if (!this.openLeft && !this.openRight) {
        re = '\\b' + re + '\\b' + '|\\s' + re + '\\s';
      }

    }
    if (wordparts.length > 1 && words.length > 1) {
      re += '|';
    }
    if (wordparts.length > 1) {
      wordparts = wordparts.substring(0, wordparts.length - 1);
      re += '(' + wordparts + ')';
    }
    matchRegex = new RegExp(re, 'i');

    debugH && console.log(matchRegex);

    //ContentEditable regex
    re = '';
    if (wordsEditable.length > 1) {
      wordsEditable = wordsEditable.substring(0, wordsEditable.length - 1);
      re += '(' + wordsEditable + ')';
      if (!this.openLeft && !this.openRight) {
        re = '\\b' + re + '\\b' + '|\\s' + re + '\\s';
      }
    }

    if (wordpartsEditable.length > 1 && wordsEditable.length > 1) {
      re += '|';
    }

    if (wordpartsEditable.length > 1) {
      wordpartsEditable = wordpartsEditable.substring(0, wordpartsEditable.length - 1);
      re += '(' + wordpartsEditable + ')';
    }
    matchRegexEditable = new RegExp(re, 'i');
    debugH && console.log('matchRegexEditable', matchRegexEditable);
  };



  // recursively apply word highlighting
  this.hiliteWords = function (node, printHighlights, inContentEditable) {

    if (node == undefined || !node) {return;}
    if (!matchRegex) {return;}

    // Begin modification for WeVote
    // Before change this was...  if (skipTags.test(node.nodeName)||skipClasses.test(node.className)) {return;}
    if (skipTags.test(node.nodeName) ||
      skipClasses.test(node.className) ||
      node.id === 'weVoteModal' ||                         // jQuery UI Dialogs
      node.id === 'noDisplayPageBeforeFraming' ||
      node.id === 'weContainer') {
      debugH && console.log('hiliteWords early recursive return node.id: ' + node.id);
      return;
    }
    debugH && console.log('hiliteWords early recursive CONTINUE node.id: ' + node.id);
    debugH && console.log('hiliteWords before iterating Through every child node using highlight words cnt: ' + (node.hasChildNodes() ? node.childNodes.length : 0));
    // End of modification for WeVote

    if (node.hasChildNodes()) {
      for (var i = 0; i < node.childNodes.length; i++) {
        this.hiliteWords(node.childNodes[i], printHighlights, inContentEditable || node.isContentEditable)
      }
    }

    if (node.nodeType == 3) { // NODE_TEXT

      let nv = node.nodeValue;
      debugH && console.log('node.nodeValue: ', node.nodeValue);
      if(inContentEditable) {
        regs = matchRegexEditable.exec(nv);
      } else {
        regs = matchRegex.exec(nv);
        if (regs) {
          debugH && console.log('regs response', regs);
        }
      }
      if (regs) {
        var wordfound = '';

        //find back the word
        for (word in wordColor) {
          var pattern = new RegExp(wordColor[word].regex, 'i');
          if (pattern.test(regs[0]) && word.length > wordfound.length) {
            wordfound = word;
            debugH && console.log('hilitor word found: ' + word)
            break;
          }
        }

        if (wordColor[wordfound] != undefined) {
          let urlHref = '';  //WeVote

          if ((node.parentElement.tagName == hiliteTag && node.parentElement.className == hiliteClassname)) {
            //skip highlighting
          }
          else {
            var match = document.createElement(hiliteTag);
            match.className = hiliteClassname;
            match.appendChild(document.createTextNode(regs[0]));
            if (printHighlights) {
              match.style = 'padding: 1px;box-shadow: 1px 1px #e5e5e5;border-radius: 3px;-webkit-print-color-adjust:exact;';
            }
            else {
              match.style = 'padding: 1px;box-shadow: 1px 1px #e5e5e5;border-radius: 3px;';
            }

            if (wordColor[wordfound].Color) {
              match.style.backgroundColor = wordColor[wordfound].Color;
            }
            if (wordColor[wordfound].Fcolor) {
              match.style.color = wordColor[wordfound].Fcolor;
            }

            match.style.fontStyle = 'inherit';

            if (!inContentEditable || (inContentEditable && wordColor[wordfound].ShowInEditableFields)) {
              // Begin modification for WeVote
              // If the name is in a link tag, disable it.
              if (node.parentNode.localName === 'a') {
                urlHref = node.parentNode.href;
                $(node.parentNode).css({
                  'pointer-events': 'none',
                  cursor: 'default'
                });
                urlsForHighlights[$(node.parentNode).text().toLowerCase()] = $(node.parentNode).attr('href');
              }
              // Icon within highlights in the DOM of the endorsement page
              if (wordColor[word].Icon.length) {
                $(match).prepend(wordColor[word].Icon);
              }

              // End of modification for WeVote
              var after = node.splitText(regs.index);
              after.nodeValue = after.nodeValue.substring(regs[0].length);

              node.parentNode.insertBefore(match, after);
            }
          }

          var nodeAttributes = this.findNodeAttributes(node.parentElement, {
            'offset': 0,
            'isInHidden': false
          });

          debugH && console.log('WORD FOUND IN DOM: ', wordColor[wordfound].word);
          highlightMarkers[numberOfHighlights] = {
            'word': wordColor[wordfound].word,
            'offset': nodeAttributes.offset,
            'hidden': nodeAttributes.isInHidden,
            'color': wordColor[wordfound].Color,
            'href': encodeURI(urlHref)
          };

          numberOfHighlights += 1;
          highlights[wordfound] = highlights[wordfound] + 1 || 1;
        }
      }
    }
  };


  this.findNodeAttributes = function (inNode, attributes) {

    attributes.offset += inNode.offsetTop;
    if (inNode.hidden || inNode.getAttribute('aria-hidden')) {
      attributes.isInHidden = true;
    }
    if (inNode.offsetParent) {
      return this.findNodeAttributes(inNode.offsetParent, attributes);

    }
    return attributes;
  };

  // remove highlighting
  this.remove = function () {
    var arr = document.getElementsByTagName(hiliteTag);
    while (arr.length && (el = arr[0])) {
      var parent = el.parentNode;
      parent.replaceChild(el.firstChild, el);
      parent.normalize();
    }
  };

  // start highlighting at target node
  this.apply = function (input, printHighlights) {
    wordColor = input;
    numberOfHighlights = 0;
    if (input == undefined || !input) {return;}

    this.setRegex(input);


    this.hiliteWords(targetNode, printHighlights, false);
    return {numberOfHighlights: numberOfHighlights, details: highlights, markers: highlightMarkers};
  };

}
