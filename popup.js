/* global $ */
/* global chrome */
// var onPageShown = false;
var debug=false;
const removeEditText = 'Remove Edit Panel From This Tab';
const openEditText = 'Open Edit Panel for this Tab';
const highlightThisText = 'Highlight Candidates on This Tab';
const removeHighlightThisText = 'Remove Highlights From This Tab';

document.addEventListener('DOMContentLoaded', function () {
  let highlightingEnabled = false;
  let highlightCandidatesOnAllTabs = localStorage['highlightCandidatesOnAllTabs'] === 'true';
  dumpTabStatus();

  console.log('chrome.extension.getBackgroundPage().highlighterEnabled: ' + chrome.extension.getBackgroundPage().highlighterEnabled);
  // console.log('localStorage[\'highlightCandidatesOnThisTab\']', localStorage['highlightCandidatesOnThisTab']);
  console.log('localStorage[\'highlightCandidatesOnAllTabs\']', localStorage['highlightCandidatesOnAllTabs']);
  if (chrome.extension.getBackgroundPage().highlighterEnabled === undefined) {
    chrome.extension.getBackgroundPage().highlighterEnabled = false;
    localStorage['highlightCandidatesOnAllTabs'] = 'false';
  } else {
    highlightingEnabled = chrome.extension.getBackgroundPage().highlighterEnabled;
    highlightCandidatesOnAllTabs = localStorage['highlightCandidatesOnAllTabs'] === 'true';
  }

  updateButtonState();

  // Master switch "Enable Highlighting"
  $('#highlightingMasterSwitch').prop('checked', highlightingEnabled).click(() => {
    // We are turning off or turning on we want to reset the two bottom buttons
    $('#highlightCandidatesThisTabButton').removeClass('weButtonRemove').text(highlightThisText);
    $('#openEditPanelButton').removeClass('weButtonRemove').text(openEditText);

    // If after the click the switch is now checked (flipped to right)...
    if ($('#highlightingMasterSwitch').is(':checked')) {
      chrome.extension.getBackgroundPage().highlighterEnabled = true;
    } else {
      chrome.extension.getBackgroundPage().highlighterEnabled = false;
      chrome.extension.getBackgroundPage().enableHighlightsForAllTabs(false);

      localStorage['highlightCandidatesOnAllTabs'] = 'false';
      $('#highlightCandidatesOnAllTabsSwitch').prop('checked', false);
    }
    event.timer = setTimeout(() => {
      window.close();
    }, 2000);

  });

  $('#highlightCandidatesOnAllTabsSwitch').prop('checked', highlightCandidatesOnAllTabs).click(() => {
    if ($('#highlightCandidatesOnAllTabsSwitch').is(':checked')) {
      $('#highlightingMasterSwitch').prop('checked', true);
      localStorage['highlightCandidatesOnAllTabs'] = 'true';
      chrome.extension.getBackgroundPage().highlighterEnabled = true;
      chrome.extension.getBackgroundPage().enableHighlightsForAllTabs(true);
    } else {
      chrome.extension.getBackgroundPage().enableHighlightsForAllTabs(false);
      localStorage['highlightCandidatesOnAllTabs'] = 'false';
    }
    event.timer = setTimeout(() => {
      window.close();
    }, 2000);
  });

  let showHighlights = false;
  $('#highlightCandidatesThisTabButton').click((event) => {
    chrome.extension.getBackgroundPage().highlighterEnabled = true;
    $('#highlightingMasterSwitch').prop('checked', true);

    // Need enable/disable logic here
    if ($('#highlightCandidatesThisTabButton').hasClass('weButtonRemove')) {  // if pressing the button would do a remove...
      $('#highlightCandidatesThisTabButton').removeClass('weButtonRemove').text(highlightThisText);
      showHighlights = false;
    } else {
      $('#highlightCandidatesThisTabButton').addClass('weButtonRemove').text(removeHighlightThisText);
      showHighlights = true;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
      console.log('enabling highlights on active tab -- popup.js tab.id: ' + tabs[0].id);
      const showEditor = false;
      chrome.extension.getBackgroundPage().setEnableForActiveTab(showHighlights, showEditor, tabs[0]);
    });
    event.timer = setTimeout(() => {
      window.close();
    }, 1000);
  });

  let showEditor = false;
  $('#openEditPanelButton').click((event) => {
    chrome.extension.getBackgroundPage().highlighterEnabled = true;
    console.log('openEditPanelButton button onClick -- popup.js');
    $('#highlightingMasterSwitch').prop('checked', true);

    // Need enable/disable logic here
    if ($('#openEditPanelButton').hasClass('weButtonRemove')) {  // if pressing the button would do a remove...
      $('#openEditPanelButton').removeClass('weButtonRemove').text(openEditText);
      showEditor = false;
    } else {
      $('#openEditPanelButton').addClass('weButtonRemove').text(removeEditText);
      showEditor = true;
      showHighlights = true;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
      console.log('enabling editor on active tab from openEditPanelButton button -- popup.js tab.id: ' + tabs[0].id);
      chrome.extension.getBackgroundPage().setEnableForActiveTab(showHighlights, showEditor, tabs[0]);
      // chrome.extension.getBackgroundPage().hackoTurnOnHandE(showHighlights, showEditor, tabs[0]);
    });
    event.timer = setTimeout(() => {
      window.close();
    }, 1000);
  });

  $('#jumpToMyBallot').click(() => {
    window.open(ballotWebAppURL, '_blank');
  });
});

function updateButtonState () {
  chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {command: 'getTabStatusValues'}, function (result){
      debug && console.log('getCurrentTabStatus() result: ', result);
      if(result) {
        let {highlighterEnabledThisTab, editorEnabledThisTab, orgName, organizationWeVoteId, organizationTwitterHandle} = result;
        if (highlighterEnabledThisTab) {
          $('#highlightCandidatesThisTabButton').addClass('weButtonRemove').text(removeHighlightThisText);
        } else {
          $('#highlightCandidatesThisTabButton').removeClass('weButtonRemove').text(highlightThisText);
        }

        if (editorEnabledThisTab) {
          $('#openEditPanelButton').addClass('weButtonRemove').text(removeEditText);
        } else {
          $('#openEditPanelButton').removeClass('weButtonRemove').text(openEditText);
        }

        if (organizationWeVoteId || organizationTwitterHandle) {
          const url = organizationTwitterHandle ? 'https://wevote.us/' + organizationTwitterHandle : 'https://wevote.us/voterguide/' + organizationWeVoteId;
          $('#allEndorsementsButton').
            text('ENDORSEMENTS: ' + orgName.toUpperCase()).
            prop('disabled', false).
            removeClass('weButtonDisable').
            click(() => window.open(url, '_blank'));
        } else {
          $('#allEndorsementsButton').
            text('ENDORSEMENTS' + orgName.toUpperCase()).
            prop('disabled', true).
            addClass('weButtonDisable').
            unbind();
        }
      }
    });
  });
}

function dumpTabStatus () {
  chrome.tabs.getAllInWindow(null, function (tabs) {
    for (let i = 0; i < tabs.length; i++) {
      const { id: tabId, url } = tabs[i];
      chrome.tabs.sendMessage(tabId, {command: 'getTabStatusValues'}, function (result){
        if (result) {
          const {highlighterEnabledThisTab, editorEnabledThisTab} = result;
          console.log('dumpTabStatus tabId: ' + tabId + ', highlight: ' + highlighterEnabledThisTab  + ', editor: ' + editorEnabledThisTab + ', url: ' + url);
        } else {
          console.log('dumpTabStatus NO RESULT tabId: ' + tabId + ', url: ' + url);
        }
      });
    }
  });
}

// function clearHighlightsFromTab () {
//   chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
//     debug&&('clearing highlights from tab');
//     chrome.tabs.sendMessage(tabs[0].id, {command: 'ClearHighlights'});
//   });
// }
//
// function onOff () {
//   if (chrome.extension.getBackgroundPage().highlighterEnabled) {
//     chrome.extension.getBackgroundPage().highlighterEnabled = false;
//   }
//   else {
//     chrome.extension.getBackgroundPage().highlighterEnabled = true;
//   }
//   renderOnOff();
// }
//
// function renderOnOff () {
//   document.getElementById('myonoffswitch').checked = chrome.extension.getBackgroundPage().highlighterEnabled;
//   if (!chrome.extension.getBackgroundPage().highlighterEnabled) {
//     document.getElementById('header').style.backgroundColor = 'grey';
//   }
//   else {
//     document.getElementById('offDesc').innerHTML = '';
//     document.getElementById('header').style.backgroundColor = '#0091EA';
//   }
// }

// function hintNonUnicodeChar (value){
//   if(value.match(/[^a-zA-Z0-9_\s]/)){
//     document.getElementById('hintNonUnicode').style.display='block';
//   }
//   else{
//     document.getElementById('hintNonUnicode').style.display='none';
//   }
// }

// function onPage () {
//   onPageShown = true;
//   if (chrome.extension.getBackgroundPage().showFoundWords) {
//     chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
//       debug && console.log("active tabs",tabs);
//       chrome.tabs.sendMessage(tabs[0].id, {command: "getMarkers"}, function (result) {
//         debug && console.log("got markers",result);
//
//         if (result == undefined) {
//           //on a chrome page
//           drawInterface();
//         }
//         else if (result[0] != undefined) {
//           document.getElementById("menu").style.display = "none";
//           document.getElementById("onPage").style.display = "block";
//           chrome.runtime.getPlatformInfo(
//             function (i) {
//
//               if (i.os == "mac") {
//                 document.getElementById("OSKey").innerHTML = "Command";
//               }
//               else {
//                 document.getElementById("OSKey").innerHTML = "Control";
//               }
//             });
//           renderFoundWords(result);
//         }
//         else {
//           drawInterface();
//         }
//       });
//     });
//   }
//   else {
//
//   drawInterface();
// }
