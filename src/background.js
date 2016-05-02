/**
 * Calls for admin provided whitelist and uses that to extract all
 * user cookies that are allowed for app with appId.
 * 
 * Filters are applied one at a time and not in conjunction. 
 * Absence of any filters will return no cookies at all.
 * 
 * @params {object} params An object containing 
 *      1. the appId of the caller
 *      2. the whitelist configuration fetched from policy
 *      3. the callback to return retrieved cookies
 */
var getAllCookies= function(params) {
  var combinedPromises= [];
  var allowed= params.configuration.whitelist.filter(function(entry) { return entry.appId === params.appId; });

  if (!allowed || allowed.length === 0) return params.callback({ cookies: [] });

  allowed.forEach(function(allowedEntry) {
    if (!allowedEntry.domain) return; // Domain required as primary filter

    var details= { domain: allowedEntry.domain };
    if (allowedEntry.name) details.name= allowedEntry.name;
    if (allowedEntry.path) details.path= allowedEntry.path;
    if (allowedEntry.url) details.url= allowedEntry.url;

    combinedPromises.push(new Promise(function(resolve, reject) {
      chrome.cookies.getAll(details, resolve);
    }));
  });

  Promise.all(combinedPromises).then(function(combinedResponses) {
    combinedResponses= combinedResponses
                        .reduce(function(prev, cur) { return prev.concat(cur); }, [])  // flatten multuple responses into single array
                        .filter(function(cookieResponse) { return cookieResponse.domain.indexOf("google.") === -1; });  // filter Google top level deomains TODO better filter

    params.callback({ cookies: combinedResponses });
  });
};

chrome.runtime.onMessageExternal.addListener(
  function(request, sender, sendResponse) {
    request= request || {};
    if (request.method === "getAllCookies") {
      chrome.storage.managed.get(function(configuration) {
        getAllCookies({ 
          appId: sender.id,
          configuration: configuration, // TODO what does Chrome give if no policy was entered by the admin?
          callback: sendResponse
        });
      });

      return true;  // Informs message handler that response is async
    } else {
       sendResponse({ sorry : "no_go" });
    }
  }
);