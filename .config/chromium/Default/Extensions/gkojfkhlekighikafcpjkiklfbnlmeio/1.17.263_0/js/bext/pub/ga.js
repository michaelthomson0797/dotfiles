// LICENSE_CODE ZON
'use strict'; /*jslint browser:true*/
define([], function(){
var E = {};
var GA_URL = 'https://ssl.google-analytics.com/ga.js';
E.inited = {};
E.init = function(id){
    if (E.inited[id])
        return;
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = GA_URL;
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
    var _gaq = window._gaq = window._gaq || [];
    _gaq.push(['_setAccount', id]);
    _gaq.push(['_trackPageview']);
    E.inited[id] = true;
};
return E; });
