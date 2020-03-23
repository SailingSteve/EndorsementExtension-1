// Content scripts are the only component of an extension that has access to the web-page's DOM. (this js file and contentWeVoteUI!)
// Chrome extensions Treat these as the contact script, and create nn instance of a pair of them, for every tab which the background Scripps communicate.
// As far as loging and access is concerned, these are part of the DOM and JavaScript of the endorsement page.
// These log to the console of the endorsement page (like sierraclub.org) in the browser, Aand communicate with the background script via chrome extension messages that are sent.
// When the endorsement page is re-opened in an iframe, access to that DOM is greatly limited.


/* eslint no-unused-vars: 0 */
/* eslint init-declarations: 0 */
/* eslint no-empty-function: 0 */
/* eslint no-lonely-if: 0 */
/* eslint no-mixed-operators: 0 */
/* eslint no-undef: 0 */
/* eslint multiline-ternary: 0 */
/* eslint no-ternary: 0 */

var wordsArray = [];
var namesToIds;
var ReadyToFindWords = true; //indicates if not in a highlight execution

var Highlight=true; // indicates if the extension needs to highlight at start or due to a change. This is evaluated in a loop
var HighlightLoopFrequency=300; // the frequency of checking if a highlight needs to occur
var HighlightLoop;
var HighlightWarmup=300; // min time to wait before running a highlight execution

var alreadyNotified = false;
var wordsReceived = false;
var highlighterEnabled = true;
let highlighterEnabledThisTab = false;
let editorEnabledThisTab = false;
var searchEngines = {
  'google.com': 'q',
  'bing.com': 'q'
};
var markerCurrentPosition = -1;
var markerPositions = [];
var highlightMarkers = {};
var markerScroll = false;
var printHighlights = true;
let voterInfo = {};
let uniqueNameMatches = [];
let voterDeviceId = '';
let tabId = -1;
var debug = true;
let urlsForHighlights = {};


$(() => {
  chrome.runtime.sendMessage({
    command: 'myTabId',
  }, function (response) {
    const { tabId: tab } = response;
    tabId = tab;
    // console.log('tabWordHighlighter this tab.id: ' + tabId);
  });

  // console.log('Hack that sets debugLocal to true in place ------------------------------------');
  // window.debugLocal = true;


  if (window.location === window.parent.location) {
    if (window.location.host.indexOf('wevote.us') > -1) {
      // Experiment February 19, 2020: get a new device ID on every new tab, on every access of the tab. Is this excessive, and does it have side effects?
      const voterDeviceId = getVoterDeviceIdFromWeVoteDomainPage();
      if (voterDeviceId.length) {
        chrome.runtime.sendMessage({
          command: 'storeDeviceId',
          voterDeviceId
        }, function (response) {
          let {lastError} = chrome.runtime;
          if (lastError) {
            console.warn('chrome.runtime.sendMessage("storeDeviceId")', lastError.message);
          }
        });
      }
    }
    //only listen for messages in the main page, not in iframes
    chrome.runtime.onMessage.addListener(
      function (request, sender, sendResponse) {
        debug && console.log('onMessage.addListener() in tabWordHighlighter got a message: '+ request.command);

        if (sender.id === 'pmpmiggdjnjhdlhgpfcafbkghhcjocai' ||
            sender.id === 'eofojjpbgfdogalmibgljcgdipkhoclc' ||
            sender.id === 'abcibokldhgkclhihipipbiaednfcpia' ||
            sender.id === 'fgmbnmjmbjenlhbefngfibmjkpbcljaj' ||
            sender.id === 'cnkjigcefmbkoffbgljmkfocdpdlilln' ||
            sender.id === 'highlightthis@deboel.eu') {

          if (request.command === 'displayHighlightsForTabAndPossiblyEditPanes') {
            const priorHighlighterEnabled = highlighterEnabled;
            const { showHighlights, showEditor, tabId } = request;
            console.log('displayHighlightsForTabAndPossiblyEditPanes request.showHighlights ', showHighlights, ', showEditor: ', showEditor, ', tabId: ' + tabId);
            if (showHighlights || showEditor) {
              highlighterEnabled = true;
            } else if (priorHighlighterEnabled) {
              // if we were enabled (master switch), and now we are not, reload the page -- if this proves to be a problem, we could reverse the highlighting.
              location.reload();
            }
            highlighterEnabledThisTab = showHighlights;
            editorEnabledThisTab = showEditor;
            displayHighlightingAndPossiblyEditor(showHighlights, showEditor, tabId);
            return false;
          } else if (request.command === 'ScrollHighlight') {
            jumpNext();
            showMarkers();
            return false
          } else if (request.command === 'getMarkers') {
            sendResponse(highlightMarkers);
            return true;
          } else if (request.command === 'ClearHighlights') {
            highlightMarkers = {};
            return false;
          } else if (request.command === 'ReHighlight') {
            highlighterEnabled = true;
            highlighterEnabledThisTab = true;
            reHighlight(request.words);
            return false;
          } else if (request.command === 'createEndorsement') {
            openSuggestionPopUp(request.selection);
            return false;
          } else if (request.command === 'revealRight') {
            revealRightAction(request.selection, request.pageURL, request.tabId);
            return false;
          } else if (request.command === 'getTabStatusValues') {
            const {orgName, organizationWeVoteId, organizationTwitterHandle} = state;
            debug && console.log('getTabStatusValues tabId: ' + tabId + ', highlighterEnabledThisTab: ' + highlighterEnabledThisTab + ', editorEnabledThisTab: ' + editorEnabledThisTab);
            sendResponse({ highlighterEnabledThisTab, editorEnabledThisTab, orgName, organizationWeVoteId, organizationTwitterHandle });
            return false;
          } else if (request.command === 'disableExtension') {
            enableHighlightsForAllTabs(false);
            return false;
          } else  {
            console.error('tabWordHighlighter in chrome.runtime.onMessage.addListener received unknown command: ' + request.command);
            return false;
          }
        }
      }
    );
  } else {
    debug && console.log('not in main page', window.location)
  }

  if (window.self !== window.top) {
    // If this page has been loaded in an iFrame, call sendGetStatus() to initiate the highlighting
    sendGetStatus ();
  }
});

function jumpNext () {
  if (markerCurrentPosition === markerPositions.length - 1 || markerCurrentPosition > markerPositions.length - 1) {
    markerCurrentPosition = -1;
  }
  markerCurrentPosition += 1;
  $(window).scrollTop(markerPositions[markerCurrentPosition] - (window.innerHeight / 2));
  //document.body.scrollTop=markerPositions[markerCurrentPosition]-(window.innerHeight/2);
}

function showMarkers () {
  debug && console.log('STEVE, background showMarkers');
  var element = document.getElementById('HighlightThisMarkers');
  if (element) {
    element.parentNode.removeChild(element);
  }

  var containerElement = document.createElement('DIV');
  containerElement.id = 'HighlightThisMarkers';

  for (marker in highlightMarkers) {
    var span = document.createElement('SPAN');
    span.className = 'highlightThisMarker';
    span.style.backgroundColor = highlightMarkers[marker].color;
    var markerposition = document.body.scrollTop + (highlightMarkers[marker].offset / document.body.clientHeight) * window.innerHeight;
    span.style.top = markerposition + 'px';
    containerElement.appendChild(span);
  }
  document.body.appendChild(containerElement);
  if (!markerScroll) {
    document.addEventListener('scroll', function () {
      showMarkers();
    });
    markerScroll = true;
  }
}

function reHighlight (words) {
  // console.log('function reHighlight(words)');
  for (let group in words) {
    if (words[group].Enabled) {
      for (word in words[group].Words) {
        debug && console.log('reHighlight word = ' + word);
        wordsArray.push({
          word: words[group].Words[word].toLowerCase(),
          'regex': globStringToRegex(words[group].Words[word]),
          'Color': words[group].Color,
          'Fcolor': words[group].Fcolor,
          'Icon': words[group].Icon,
          'FindWords': words[group].FindWords,
          'ShowInEditableFields': words[group].ShowInEditableFields
        });
      }
    }
  }
  console.log('reHighlight before findWords IS NOT CALLED at this time --------------------------- namesToIds: ', namesToIds, ', tabId: ', state.tabId);

  findWords();
}

function getVoterDeviceIdFromWeVoteDomainPage () {
  // Capture the voter_device_id if we are on a wevote page
  const tag = 'voter_device_id';
  let b = document.cookie.match('(^|[^;]+)\\s*' + tag + '\\s*=\\s*([^;]+)');
  let id = b ? b.pop() : '';
  debug && console.log('getVoterDeviceIdFromWeVoteDomainPage ------------TE--------------> ' + id);
  return id;
}

// When a tab sends the getStatus message, it starts a whole sequence of events and other messages, that go to the API server
// and retrieves the appropriate candidate names, brings them back to the extension, and then starts highlighting the candidate names
// on the endorsement page that is displayed in the tab (for example, https://www.sierraclub.org/california/2020-endorsements/).
function sendGetStatus () {
  chrome.runtime.sendMessage({command: 'getStatus'}, function (response) {
    // console.log('chrome.runtime.sendMessage({command: \'getStatus\'}');
    let {lastError} = chrome.runtime;
    if (lastError) {
      console.warn('chrome.runtime.sendMessage("getStatus")', lastError.message);
      return;
    }
    debug && console.log('reponse from getStatus', window.location);
    highlighterEnabled = response.highlighterEnabled;
    highlighterEnabledThisTab  = response.highlighterEnabled;  // These start out identical, but this one is initialized us false
    // console.log('response from sendStatus highlighterEnabled: ', highlighterEnabled, ', highlighterEnabledThisTab: ', highlighterEnabledThisTab);
    if (highlighterEnabled) {
      debug && console.log('about to get words', window.location);
      getWordsThenStartHighlighting();
    }
  });
}

function getWordsThenStartHighlighting () {
  // console.log('Called getWordsThenStartHighlighting() tabId: ', tabId);
  chrome.runtime.sendMessage({
    command: 'getWords',
    url: location.href.replace(location.protocol + '//', ''),
    id: getVoterDeviceIdFromWeVoteDomainPage()  // is this nonsense?
  }, function (response) {
    debug && console.log('Received response in getWordsThenStartHighlighting');

    let {lastError} = chrome.runtime;
    if (lastError) {
      console.warn('chrome runtime sendMessage("getWords")',lastError.message);
      return;
    }
    debug && console.log('got words response: ', response);
    const id = response.storedDeviceId ? response.storedDeviceId : '';
    if (response.storedDeviceId && response.storedDeviceId.length > 0) {
      voterDeviceId = id;
    }

    for (let group in response.words) {
      if (response.words[group].Enabled) {
        for (word in response.words[group].Words) {
          debug && console.log('getWords response, ' + word + ', group: ' + group + ', findWords: ' + response.words[group].FindWords + ' icon: ' + response.words[group].Icon);
          let wordText = response.words[group].Words[word];
          if (wordText) {  // Sept 15, 2019:  Sometimes we get bad data, just skip it
            wordsArray.push({
              word: response.words[group].Words[word].toLowerCase(),
              'regex': globStringToRegex(response.words[group].Words[word]),
              'Color': response.words[group].Color,
              'Fcolor': response.words[group].Fcolor,
              'Icon': response.words[group].Icon,
              'FindWords': response.words[group].FindWords,
              'ShowInEditableFields': response.words[group].ShowInEditableFields
            });
          }
        }
      }
    }

    if (response.words.nameToIdMap) {
      namesToIds = response.words.nameToIdMap;  // This is the one that delivers, when in an iFrame.  It probably is all we need if not in a frame.
    }

    debug && console.log('processed words');
    wordsReceived = true;

    //start the highlight loop
    highlightLoop();

    if (!document.getElementById('wediv')) {
      const head = document.head || document.getElementsByTagName('head')[0];

      const style = document.createElement('style');
      head.append(style);
      style.type = 'text/css';
      // Note that the source code for this css is in popupIFrame.html, where it can be tested in a browser, then minified with https://cssminifier.com/
      const css = '#wediv{position:absolute;z-index:9;background-color:#000;text-align:center;border:1px solid #d3d3d3;box-shadow:10px 10px 5px 0 rgba(0,0,0,.4)}#wedivheader{cursor:move;z-index:10;background-color:#2196f3;color:#fff;height:30px}#frameBorder{border-style:solid;border-color:#a9a9a9;border-width:4px}#weIFrame{width:400px;height:450px}#wetitle{float:left;margin-left:8px;margin-top:2px}.weclose{height:10px;width:10px;padding-top:5px;float:right;margin-right:16px;background-color:#2196f3;color:#fff;border:none;font-weight:bolder;font-stretch:extra-expanded;font-size:12pt}';
      style.appendChild(document.createTextNode(css));

      const js = document.createElement('script');
      // Note that the source code for this innerHTML is in popupIFrame.html, where it can be tested, then minified with https://javascript-minifier.com/
      js.innerHTML ='function dragElement(e){let t=0,n=0,o=0,l=0;function d(e){(e=e||window.event).preventDefault(),o=e.clientX,l=e.clientY,document.onmouseup=m,document.onmousemove=f}function f(d){(d=d||window.event).preventDefault(),t=o-d.clientX,n=l-d.clientY,o=d.clientX,l=d.clientY,e.style.top=e.offsetTop-n+"px",e.style.left=e.offsetLeft-t+"px",console.log("position of elmnt after drag: ",e.style.top,e.style.left)}function m(){document.onmouseup=null,document.onmousemove=null}document.getElementById(e.id+"header")?document.getElementById(e.id+"header").onmousedown=d:e.onmousedown=d}function setModal(e,t,n){let o=document.getElementById(n);o||(o={offsetLeft:0,offsetTop:0});const l=document.getElementById("wediv"),d=document.getElementById("weIFrame"),f=window.pageYOffset||document.documentElement.scrollTop;l.hidden=!e,l.style.left=o.offsetLeft+300+"px",l.style.top=o.offsetTop+f+"px",t&&t.length&&(d.src=t),dragElement(l)}';
      // js.onload = () => console.log('------------- js loaded');
      head.appendChild(js);
      const markup = document.createElement('div');
      markup.id = 'wediv';
      markup.hidden = true;
      markup.innerHTML =
        '<div id="wedivheader">\n' +
        '  <span id="wetitle">Create a We Vote Endorsement</span>\n' +
        '  <span id="closeButton">\n' +
        '    <button type="button" class="weclose" onclick="setModal(false,\'\' ,\'\')">X</button>\n' +
        '  </span>\n' +
        '</div>\n' +
        '<div id="frameBorder">\n' +
        '  <iframe id="weIFrame" src="' + extensionWarmUpPage + '"></iframe>\n' +
        '</div>\n';
      $('body').first().prepend(markup);
    }
  });
}

$(document).ready(function () {
  Highlight=true;

  debug && console.log('setup binding of dom sub tree modification');
  $('body').bind('DOMSubtreeModified', function () {
    //debug && console.log("dom sub tree modified");
    Highlight=true;
  });
});


function highlightLoop (){

  ReadyToFindWords = true;

  HighlightLoop = setInterval(function () {
    Highlight&&ReadyToFindWords&&findWords()
  }, HighlightLoopFrequency);

}

function getSearchKeyword () {
  let searchKeyword = null;
  if (document.referrer) {
    for (searchEngine in searchEngines) {
      if (document.referrer.indexOf(searchEngine)) {
        searchKeyword = getSearchParameter(searchEngines[searchEngine]);
      }
    }
  }
  return searchKeyword;
}

function getSearchParameter (n) {
  const half = document.referrer.split(n + '=')[1];
  return half !== undefined ? decodeURIComponent(half.split('&')[0]) : null;
}

/*function start() {
    debug && console.log("in start");
    if (wordsReceived == true) {
        debug && console.log("in start - words received");
        Highlight=true
        $("body").bind("DOMSubtreeModified", function () {
            debug && console.log("dom sub tree modified", readyToFindWords);
            Highlight=true;
        });
    }
    else {
        setTimeout(function () {
            debug && console.log('waiting for words');
            start();
        }, 250);
    }
}*/

// <td>
//   <em class="Highlight" style="padding: 1px; box-shadow: rgb(229, 229, 229) 1px 1px; border-radius: 3px; " +
//             "-webkit-print-color-adjust: exact; background-color: rgb(124, 123, 124); " +
//             "color: rgb(255, 255, 255); font-style: inherit;">Kate Gallego</em>
// </td>
// function removeAllHighlights () {
//   // For some reason when we get here, the dom for the iframe is inaccessible, even though it should be in the same
//   // domain.
//   // 9/26/19:  Will go with a iframe reload for now
//
//   // let bod = $('body');
//   // let ems = $(bod).children().find('em.Highlight');
//   var arr = document.getElementsByTagName('EM');
//   var fd = document.getElementById('frameDiv');
//   let f0 = $('iframe')[0];
//   let f0b = $(f0).find(':button');
//   let f0e = $(f0).find('em');
//
//   let b2 = $('body').find('em');
//   let b3 = $('body').find('em.Highlight');
//   let b4 = $('body em');
//   let b5 = $('body em.Highlight');
//   let buttons = $('body').find(':button');
//   console.log($('#weContainer').html());
//
//   $('em.Highlight').each((em) => {
//     let text = $(em).text();
//     console.log('removeAll: ' + i + ', ' + text);
//     $(em).replace(text);
//   });
//   // ems.replaceWith(ems.innerText);
// }


function findWords () {
  if (Object.keys(wordsArray).length > 0) {
    Highlight=false;

    setTimeout(function () {
      debug && console.log('finding words',window.location);

      ReadyToFindWords=false;

      var changed = false;
      var myHilitor = new Hilitor();
      var highlights = myHilitor.apply(wordsArray, printHighlights);
      // console.log('after myHilitor.apply num highlights: ' + highlights.numberOfHighlights);
      if (highlights.numberOfHighlights > 0) {
        highlightMarkers = highlights.markers;
        markerPositions = [];
        for (marker in highlightMarkers) {
          if (markerPositions.indexOf(highlightMarkers[marker].offset) === -1) {
            markerPositions.push(highlightMarkers[marker].offset);
          }
        }
        markerPositions.sort();

        let len = Object.keys(highlightMarkers).length;
        for (let i = 0; i < len; i++) {
          let {word} = highlightMarkers[i];
          if (!uniqueNameMatches.includes(word)) {
            uniqueNameMatches.push(word);
          }
        }

        chrome.runtime.sendMessage({
          command: 'showHighlightsCount',
          label: highlights.numberOfHighlights.toString(),
          uniqueNames: uniqueNameMatches,
          altColor: uniqueNameMatches.length ? '' : 'darkgreen',
        }, function (response) {
          let {lastError} = chrome.runtime;
          if (lastError) {
            console.warn(' chrome.runtime.sendMessage("showHighlightsCount")',lastError.message);
          }
        });
      } else {
        chrome.runtime.sendMessage({
          command: 'showHighlightsCount',
          label: '0',
          uniqueNames: [],
          altColor: 'darkgreen',
        }, function (response) {
          let {lastError} = chrome.runtime;
          if (lastError) {
            console.warn(' chrome.runtime.sendMessage("showHighlightsCount")', lastError.message);
          }
        });
      }
      //setTimeout(function () {
      ReadyToFindWords = true;
      //}, HighligthCooldown);
    }, HighlightWarmup);
  }

  // This following log line floods the log, and slow things down -- use sparingly while debugging
  // debug && console.log('finished finding words');
}

function revealRightAction (selection, pageURL, tabId) {
  const nameMatchElement = $('#sideArea').contents().find(':contains(' + selection + '):last');
  if (nameMatchElement.length) {
    $(nameMatchElement)[0].scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      // inline: 'center'
    });
  }
}

// This allows the popup to find out if this tab is highlighted and/or editors are displayed
function getDisplayedTabStatus (tabId) {
  debug && console.log('getDisplayedTabStatus tabId: ' + tabId + ', highlighterEnabledThisTab: ' + highlighterEnabledThisTab + ', editorEnabledThisTab: ' + editorEnabledThisTab);
  return {
    highlighterEnabledThisTab,
    editorEnabledThisTab,
  };
}

function globStringToRegex (str) {
  return preg_quote(str).replace(/\\\*/g, '\\S*').replace(/\\\?/g, '.');
}

function preg_quote (str,delimiter) {
  // http://kevin.vanzonneveld.net
  // +   original by: booeyOH
  // +   improved by: Ates Goral (http://magnetiq.com)
  // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +   bugfixed by: Onno Marsman
  // +   improved by: Brett Zamir (http://brett-zamir.me)
  // *     example 1: preg_quote("$40");
  // *     returns 1: '\$40'
  // *     example 2: preg_quote("*RRRING* Hello?");
  // *     returns 2: '\*RRRING\* Hello\?'
  // *     example 3: preg_quote("\\.+*?[^]$(){}=!<>|:");
  // *     returns 3: '\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:'
  return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
}
