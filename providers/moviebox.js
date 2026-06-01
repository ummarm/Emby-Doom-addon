var _0x553e2c=_0x2502;(function(_0x47b53c,_0x1d716b){var _0x3c5e0f=_0x2502,_0x5d3e37=_0x47b53c();while(!![]){try{var _0x2d52d4=parseInt(_0x3c5e0f(0x17e))/0x1*(-parseInt(_0x3c5e0f(0x178))/0x2)+parseInt(_0x3c5e0f(0x167))/0x3*(parseInt(_0x3c5e0f(0x19e))/0x4)+parseInt(_0x3c5e0f(0x1a7))/0x5*(parseInt(_0x3c5e0f(0x1ad))/0x6)+parseInt(_0x3c5e0f(0x169))/0x7*(parseInt(_0x3c5e0f(0x17b))/0x8)+-parseInt(_0x3c5e0f(0x1ba))/0x9*(-parseInt(_0x3c5e0f(0x1b2))/0xa)+parseInt(_0x3c5e0f(0x1a4))/0xb+-parseInt(_0x3c5e0f(0x168))/0xc;if(_0x2d52d4===_0x1d716b)break;else _0x5d3e37['push'](_0x5d3e37['shift']());}catch(_0x1e36c8){_0x5d3e37['push'](_0x5d3e37['shift']());}}}(_0x3e6b,0x537df));var API=_0x553e2c(0x1b7),TMDB_KEY=_0x553e2c(0x16b),TMDB_URL=_0x553e2c(0x18a),SITE=_0x553e2c(0x1aa),cache=new Map(),CACHE_TTL=0x14*0x3c*0x3e8;function getCached(_0x4fd99e){var _0x29d776=_0x553e2c,_0x57a88b=cache['get'](_0x4fd99e);if(!_0x57a88b)return void 0x0;if(Date[_0x29d776(0x1ab)]()-_0x57a88b['ts']>CACHE_TTL)return cache[_0x29d776(0x190)](_0x4fd99e),void 0x0;return _0x57a88b['val'];}function setCached(_0x55615a,_0x26ffa8){var _0x2538d5=_0x553e2c;cache[_0x2538d5(0x16a)]>0x12c&&cache['delete'](cache['keys']()[_0x2538d5(0x164)]()[_0x2538d5(0x1b6)]),cache[_0x2538d5(0x187)](_0x55615a,{'val':_0x26ffa8,'ts':Date[_0x2538d5(0x1ab)]()});}function genToken(){var _0x2da9da=_0x553e2c,_0x180ba9=Math[_0x2da9da(0x18f)](Date[_0x2da9da(0x1ab)]()/0x3e8)[_0x2da9da(0x186)](),_0x205317=_0x180ba9[_0x2da9da(0x18e)]('')[_0x2da9da(0x19a)]()[_0x2da9da(0x188)](''),_0x156809=CryptoJS[_0x2da9da(0x1af)](_0x205317)[_0x2da9da(0x186)](CryptoJS[_0x2da9da(0x183)][_0x2da9da(0x16f)]);return _0x180ba9+'.'+_0x156809;}function baseHdrs(_0x385dac){var _0x540575=_0x553e2c,_0x510ed8={'Accept':_0x540575(0x18d),'Content-Type':_0x540575(0x18d),'Origin':SITE,'Referer':SITE+'/','User-Agent':_0x540575(0x174),'x-client-info':'{\x22timezone\x22:\x22Asia/Calcutta\x22}','x-request-lang':'en','X-Client-Token':genToken()};if(_0x385dac){for(var _0x8408 in _0x385dac)_0x510ed8[_0x8408]=_0x385dac[_0x8408];}return _0x510ed8;}function apiCall(_0x1335b8,_0xba5a20,_0x49857e,_0x5936ab){var _0x4f0017=_0x553e2c,_0x3d6a8e={'method':_0x1335b8,'headers':baseHdrs(_0x5936ab)};if(_0x49857e)_0x3d6a8e['body']=JSON[_0x4f0017(0x1b3)](_0x49857e);return fetch(_0xba5a20,_0x3d6a8e)['then'](function(_0x415325){var _0x13f425=_0x4f0017;return _0x415325[_0x13f425(0x199)]()[_0x13f425(0x17a)](function(_0x3d78ad){if(!_0x415325['ok'])return null;try{return JSON['parse'](_0x3d78ad);}catch(_0x3865fd){return _0x3d78ad;}});})[_0x4f0017(0x1a5)](function(){return null;});}function getTmdb(_0x379be2,_0x1eba66){var _0x4e49fe=_0x553e2c,_0x36fc35=_0x4e49fe(0x1a9)+_0x379be2,_0x2a4a51=getCached(_0x36fc35);if(_0x2a4a51)return Promise[_0x4e49fe(0x173)](_0x2a4a51);var _0x4b3a4c=_0x1eba66===_0x4e49fe(0x165)||_0x1eba66==='tv'?'tv':_0x4e49fe(0x1ac);return fetch(TMDB_URL+'/'+_0x4b3a4c+'/'+_0x379be2+_0x4e49fe(0x189)+TMDB_KEY)[_0x4e49fe(0x17a)](function(_0x181600){var _0x1c7fc0=_0x4e49fe;return _0x181600[_0x1c7fc0(0x192)]();})['then'](function(_0x3c7b10){var _0x2349ff=_0x4e49fe,_0x50af34={'title':_0x4b3a4c===_0x2349ff(0x1ac)?_0x3c7b10[_0x2349ff(0x182)]||_0x3c7b10[_0x2349ff(0x1b5)]:_0x3c7b10['name']||_0x3c7b10['original_name'],'year':(_0x3c7b10[_0x2349ff(0x1b0)]||_0x3c7b10[_0x2349ff(0x19f)]||'')[_0x2349ff(0x1a2)](0x0,0x4),'mediaType':_0x4b3a4c};return setCached(_0x36fc35,_0x50af34),_0x50af34;})[_0x4e49fe(0x1a5)](function(){return null;});}function normTitle(_0x227618){var _0x5521dc=_0x553e2c;if(!_0x227618)return'';return _0x227618[_0x5521dc(0x19d)](/\[.*?\]/g,'\x20')[_0x5521dc(0x19d)](/\(.*?\)/g,'\x20')[_0x5521dc(0x19d)](/\b(dub|dubbed|hd|4k|hindi|tamil|telugu)\b/gi,'\x20')['replace'](/\b(dual audio)\b/gi,'\x20')['trim']()[_0x5521dc(0x17d)]()[_0x5521dc(0x19d)](/:/g,'\x20')['replace'](/[^\w\s]/g,'\x20')[_0x5521dc(0x19d)](/\s+/g,'\x20');}function extractLang(_0x15abd3){var _0x2f8b32=_0x553e2c;if(!_0x15abd3)return _0x2f8b32(0x1b4);var _0x14e9fe=_0x15abd3[_0x2f8b32(0x166)](/\[([^\]]+)\]/);if(_0x14e9fe){var _0x159b4f=_0x14e9fe[0x1][_0x2f8b32(0x1b1)]();return _0x159b4f['toLowerCase']()[_0x2f8b32(0x16e)](_0x2f8b32(0x193))>=0x0?_0x159b4f:_0x159b4f+'\x20Dub';}return _0x2f8b32(0x1b4);}function baseTitle(_0x33a18e){var _0x19e82e=_0x553e2c;if(!_0x33a18e)return'';return _0x33a18e['replace'](/\s*S\d+(?:-S?\d+)*$/i,'')[_0x19e82e(0x19d)](/\s*\[.*?\]\s*/g,'\x20')[_0x19e82e(0x1b1)]();}function searchBox(_0x4783a4){var _0x1373ba=_0x553e2c,_0x2080f9='search_'+_0x4783a4,_0xc8e09c=getCached(_0x2080f9);if(_0xc8e09c)return Promise[_0x1373ba(0x173)](_0xc8e09c);return apiCall(_0x1373ba(0x17c),API+_0x1373ba(0x18b),{'keyword':_0x4783a4,'page':0x1,'perPage':0x1c,'subjectType':0x0})[_0x1373ba(0x17a)](function(_0x4baadc){var _0x1bf52b=_0x1373ba,_0x45cb2b=_0x4baadc&&_0x4baadc[_0x1bf52b(0x198)]&&_0x4baadc[_0x1bf52b(0x198)][_0x1bf52b(0x191)]||[];return setCached(_0x2080f9,_0x45cb2b),_0x45cb2b;});}function findMatches(_0x29f907,_0x4d7665,_0x1e7794,_0x3472eb){var _0x2ea3db=_0x553e2c,_0x107cc5=normTitle(_0x4d7665),_0x42e2e1=_0x3472eb===_0x2ea3db(0x1ac)?0x1:0x2,_0x5ecb38=[],_0x1e311a={};for(var _0x2762ac=0x0;_0x2762ac<_0x29f907[_0x2ea3db(0x195)];_0x2762ac++){var _0x50fb9b=_0x29f907[_0x2762ac];if(_0x50fb9b[_0x2ea3db(0x170)]!==_0x42e2e1)continue;if(_0x1e311a[_0x50fb9b[_0x2ea3db(0x172)]])continue;var _0x22d110=baseTitle(_0x50fb9b[_0x2ea3db(0x182)]),_0x37d7b6=normTitle(_0x22d110),_0x403d2a=_0x50fb9b['year']||(_0x50fb9b['releaseDate']?_0x50fb9b[_0x2ea3db(0x1a1)][_0x2ea3db(0x1a2)](0x0,0x4):null),_0x4916e3=0x0;if(_0x37d7b6===_0x107cc5)_0x4916e3+=0x32;else{if(_0x37d7b6[_0x2ea3db(0x16e)](_0x107cc5)>=0x0||_0x107cc5[_0x2ea3db(0x16e)](_0x37d7b6)>=0x0)_0x4916e3+=0xf;}if(_0x1e7794&&_0x403d2a&&_0x1e7794==_0x403d2a)_0x4916e3+=0x23;_0x4916e3>=0x28&&(_0x1e311a[_0x50fb9b[_0x2ea3db(0x172)]]=!![],_0x5ecb38[_0x2ea3db(0x196)]({'id':_0x50fb9b['subjectId'],'lang':extractLang(_0x50fb9b[_0x2ea3db(0x182)]),'dp':_0x50fb9b['detailPath']||'','title':_0x50fb9b[_0x2ea3db(0x182)]}));}return _0x5ecb38[_0x2ea3db(0x1a6)](function(_0x53f10b,_0x5cf56d){var _0x4488c0=_0x2ea3db;if(_0x53f10b['lang']===_0x4488c0(0x1b4))return-0x1;if(_0x5cf56d[_0x4488c0(0x17f)]==='Original')return 0x1;return 0x0;}),_0x5ecb38;}function _0x2502(_0x4e3cbf,_0x38eee4){_0x4e3cbf=_0x4e3cbf-0x164;var _0x3e6b63=_0x3e6b();var _0x2502f0=_0x3e6b63[_0x4e3cbf];if(_0x2502['hupeKp']===undefined){var _0x44470a=function(_0x5c3f92){var _0x73fecd='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';var _0x4fd99e='',_0x57a88b='';for(var _0x55615a=0x0,_0x26ffa8,_0x180ba9,_0x205317=0x0;_0x180ba9=_0x5c3f92['charAt'](_0x205317++);~_0x180ba9&&(_0x26ffa8=_0x55615a%0x4?_0x26ffa8*0x40+_0x180ba9:_0x180ba9,_0x55615a++%0x4)?_0x4fd99e+=String['fromCharCode'](0xff&_0x26ffa8>>(-0x2*_0x55615a&0x6)):0x0){_0x180ba9=_0x73fecd['indexOf'](_0x180ba9);}for(var _0x156809=0x0,_0x385dac=_0x4fd99e['length'];_0x156809<_0x385dac;_0x156809++){_0x57a88b+='%'+('00'+_0x4fd99e['charCodeAt'](_0x156809)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x57a88b);};_0x2502['rasCdZ']=_0x44470a,_0x2502['XjADIy']={},_0x2502['hupeKp']=!![];}var _0x36e4eb=_0x3e6b63[0x0],_0x350f5d=_0x4e3cbf+_0x36e4eb,_0x4bc624=_0x2502['XjADIy'][_0x350f5d];return!_0x4bc624?(_0x2502f0=_0x2502['rasCdZ'](_0x2502f0),_0x2502['XjADIy'][_0x350f5d]=_0x2502f0):_0x2502f0=_0x4bc624,_0x2502f0;}function getDownloads(_0x64674a,_0x4ce1dc,_0x14b607,_0x2bece4){var _0x27d663=_0x553e2c,_0x130121=_0x27d663(0x176)+_0x64674a+'_'+_0x4ce1dc+'_'+_0x14b607,_0x797124=getCached(_0x130121);if(_0x797124)return Promise['resolve'](_0x797124);var _0x484720=API+_0x27d663(0x16d)+_0x64674a;if(_0x4ce1dc!=null)_0x484720+=_0x27d663(0x1b9)+_0x4ce1dc;if(_0x14b607!=null)_0x484720+='&ep='+_0x14b607;return apiCall('GET',_0x484720,null,{'Referer':SITE+_0x27d663(0x18c)+_0x2bece4})[_0x27d663(0x17a)](function(_0x25ebda){var _0x556a56=_0x27d663,_0x593b54=_0x25ebda&&_0x25ebda[_0x556a56(0x198)]&&_0x25ebda['data']['downloads']||[];return setCached(_0x130121,_0x593b54),_0x593b54;});}function _0x3e6b(){var _0x185597=['DgHLBG','nte4mty1nNf1txfhsW','ue9tva','Dg9mB3DLCKnHC2u','mZC4ndy3v2vmz0Xx','BgfUzW','zgv0ywLSxW','C2vHC29UCW','DgL0Bgu','zw5J','tw92AwvcB3G','zxHWB3j0CW','Dg9tDhjPBMC','C2v0','AM9PBG','p2fWAv9RzxK9','Ahr0Chm6lY9HCgKUDgHLBw92AwvKyI5VCMCVmW','l3DLzMvLzc1OnwfWAs1IzMyVC3vIAMvJDc9ZzwfYy2G','l3DHDgnOlW','yxbWBgLJyxrPB24VANnVBG','C3bSAxq','zMXVB3i','zgvSzxrL','AxrLBxm','ANnVBG','zhvI','DMLKzw8','BgvUz3rO','ChvZAa','C2XPy2u','zgf0yq','Dgv4Da','CMv2zxjZzq','BwvKAwfuExbL','EwvHCG','CMvWBgfJzq','mZzKEg5et2C','zMLYC3rFywLYx2rHDgu','DxjS','CMvSzwfZzurHDgu','C3vIC3rYAw5N','CxvHBgL0Eq','ndC0otmWnvHZwgvurq','y2f0y2G','C29YDa','ode1nufRDgnXtW','qxv0BW','Dg1KyL8','Ahr0Chm6lY90AgvTB3zPzwjVEc5VCMC','BM93','Bw92Awu','nZH0rK1JtLG','Bw92AwvIB3G','tuq1','CMvSzwfZzv9KyxrL','DhjPBq','nJa0mJbmD2zJExi','C3rYAw5NAwz5','t3jPz2LUywW','B3jPz2LUywXFDgL0Bgu','DMfSDwu','Ahr0Chm6lY9Ons1HCgKUyw9UzxjVB20Uy29T','CMvZB3vYy2u','jNnLpq','odf3AhrYvuu','BMv4Da','C2vYAwvZ','Bwf0y2G','ndqXmZztshPfCuS','nJGWndaXmNzuvvrJyG','n2nWr2f6tG','C2L6zq','zdeZmtaXn2nJyZzLntq2mMe4mwm5mZa0zdiXndC2zgu','r0vu','l3DLzMvLzc1OnwfWAs1IzMyVC3vIAMvJDc9KB3DUBg9Hzd9ZDwjQzwn0swq9','Aw5KzxHpzG','sgv4','C3vIAMvJDfr5Cgu','l3DLzMvLzc1OnwfWAs1IzMyVzgv0ywLSp2rLDgfPBfbHDgG9','C3vIAMvJDeLK','CMvZB2X2zq','tw96AwXSys81lJaGkfDPBMrVD3mGtLqGmtaUmdSGv2LUnJq7ihG2ncKGqxbWBgvxzwjlAxqVntm3lJm2','Bwf4rxa','zgXF','CMvZB2X1DgLVBG','mNfRuLHeDW','AgXZ'];_0x3e6b=function(){return _0x185597;};return _0x3e6b();}function getDetail(_0x3dfdf2){var _0xdd5cf1=_0x553e2c,_0x3a2a37=_0xdd5cf1(0x180)+_0x3dfdf2,_0x1bb69c=getCached(_0x3a2a37);if(_0x1bb69c)return Promise[_0xdd5cf1(0x173)](_0x1bb69c);return apiCall(_0xdd5cf1(0x16c),API+_0xdd5cf1(0x171)+_0x3dfdf2)['then'](function(_0x187383){var _0x3916ff=_0xdd5cf1,_0x192420=_0x187383&&_0x187383[_0x3916ff(0x198)];return setCached(_0x3a2a37,_0x192420),_0x192420;});}function buildStreams(_0x516783,_0xac931f){var _0xe7b3d2=_0x553e2c,_0x594201={},_0x114efd=[];for(var _0x32448c=0x0;_0x32448c<_0x516783[_0xe7b3d2(0x195)];_0x32448c++){var _0x5c38f3=_0x516783[_0x32448c];if(!_0x5c38f3['url']||_0x594201[_0x5c38f3[_0xe7b3d2(0x1a0)]])continue;_0x594201[_0x5c38f3[_0xe7b3d2(0x1a0)]]=!![];var _0x2a49b7=(_0x5c38f3[_0xe7b3d2(0x177)]||_0xe7b3d2(0x1a8))+'p',_0x30f614=null,_0x1a3bee=_0x5c38f3[_0xe7b3d2(0x1a0)][_0xe7b3d2(0x17d)]();if(_0x1a3bee[_0xe7b3d2(0x16e)]('.m3u8')>=0x0)_0x30f614=_0xe7b3d2(0x179);else{if(_0x1a3bee['indexOf']('.mp4')>=0x0||_0x1a3bee[_0xe7b3d2(0x16e)]('.mkv')>=0x0)_0x30f614=_0xe7b3d2(0x194);}var _0x2c66a3=[_0xe7b3d2(0x184)];if(_0xac931f&&_0xac931f!==_0xe7b3d2(0x1b4))_0x2c66a3['push'](_0xac931f);_0x2c66a3[_0xe7b3d2(0x196)](_0x2a49b7),_0x114efd[_0xe7b3d2(0x196)]({'name':_0x2c66a3['join']('\x20|\x20'),'title':_0x2a49b7,'url':_0x5c38f3[_0xe7b3d2(0x1a0)],'quality':_0x2a49b7,'type':_0x30f614,'headers':{'Referer':SITE+'/','Origin':SITE},'provider':_0xe7b3d2(0x1ae)});}return _0x114efd;}function processMatches(_0x1e0094,_0x131f79,_0x41844c,_0x570c4f){var _0x4ff66c=_0x553e2c,_0x39eb50=_0x131f79[_0x4ff66c(0x19b)]==='tv',_0x533166=_0x39eb50?parseInt(_0x41844c,0xa)||0x1:0x0,_0x26af2a=_0x39eb50?parseInt(_0x570c4f,0xa)||0x1:0x0,_0x59b039={},_0x373b64=[];for(var _0x5de1fa=0x0;_0x5de1fa<_0x1e0094[_0x4ff66c(0x195)];_0x5de1fa++){!_0x59b039[_0x1e0094[_0x5de1fa]['id']]&&(_0x59b039[_0x1e0094[_0x5de1fa]['id']]=!![],_0x373b64[_0x4ff66c(0x196)](_0x1e0094[_0x5de1fa]));}var _0x24157f=null;_0x39eb50&&_0x373b64['length']>0x0&&(_0x24157f=getDetail(_0x373b64[0x0]['dp']));var _0x108b38=_0x373b64['map'](function(_0x15df34){if(_0x39eb50)return _0x24157f['then'](function(_0xbf54a3){var _0x16ae14=_0x2502,_0x266ac4=_0xbf54a3&&_0xbf54a3[_0x16ae14(0x1b8)],_0x157fd5=_0x533166,_0x4f86c3=_0x26af2a;if(_0x266ac4&&_0x266ac4[_0x16ae14(0x181)])for(var _0x1b06cd=0x0;_0x1b06cd<_0x266ac4['seasons']['length'];_0x1b06cd++){if(_0x266ac4[_0x16ae14(0x181)][_0x1b06cd]['se']==_0x533166){_0x266ac4[_0x16ae14(0x181)][_0x1b06cd][_0x16ae14(0x175)]>0x0&&_0x26af2a>_0x266ac4[_0x16ae14(0x181)][_0x1b06cd][_0x16ae14(0x175)]&&(_0x4f86c3=_0x266ac4[_0x16ae14(0x181)][_0x1b06cd][_0x16ae14(0x175)]);break;}}return getDownloads(_0x15df34['id'],_0x157fd5,_0x4f86c3,_0x15df34['dp'])[_0x16ae14(0x17a)](function(_0x552e68){var _0x52bfaa=_0x16ae14;return buildStreams(_0x552e68,_0x15df34[_0x52bfaa(0x17f)]);});});return getDownloads(_0x15df34['id'],0x0,0x0,_0x15df34['dp'])['then'](function(_0x248c6f){var _0x585aef=_0x2502;return buildStreams(_0x248c6f,_0x15df34[_0x585aef(0x17f)]);});});return Promise['all'](_0x108b38)[_0x4ff66c(0x17a)](function(_0x5530a4){var _0xfde623=_0x4ff66c,_0x3247b5=[];for(var _0x9b4902=0x0;_0x9b4902<_0x5530a4[_0xfde623(0x195)];_0x9b4902++){_0x3247b5=_0x3247b5['concat'](_0x5530a4[_0x9b4902]);}return _0x3247b5[_0xfde623(0x1a6)](function(_0x1383d7,_0x5e64aa){var _0x824405=_0xfde623,_0xf7281f=parseInt(_0x1383d7[_0x824405(0x1a3)])||0x0,_0xd3040d=parseInt(_0x5e64aa['quality'])||0x0;if(_0xd3040d!==_0xf7281f)return _0xd3040d-_0xf7281f;var _0x33a840=_0x1383d7['name'][_0x824405(0x16e)]('Original')>=0x0?0x0:0x1,_0xa0c198=_0x5e64aa['name'][_0x824405(0x16e)]('Original')>=0x0?0x0:0x1;return _0x33a840-_0xa0c198;}),_0x3247b5;});}function getStreams(_0x1f39fc,_0x45efd5,_0x3efb30,_0xd5ed8a){var _0x24d86a=_0x553e2c;if(_0x3efb30==null)_0x3efb30=0x1;if(_0xd5ed8a==null)_0xd5ed8a=0x1;return getTmdb(_0x1f39fc,_0x45efd5)[_0x24d86a(0x17a)](function(_0x4dfb4c){var _0x3ddd5d=_0x24d86a;if(!_0x4dfb4c)return[];return searchBox(_0x4dfb4c[_0x3ddd5d(0x182)])['then'](function(_0x25517e){var _0x41f34f=_0x3ddd5d,_0x3b86f5=findMatches(_0x25517e,_0x4dfb4c[_0x41f34f(0x182)],_0x4dfb4c[_0x41f34f(0x19c)],_0x4dfb4c[_0x41f34f(0x19b)]);if(_0x3b86f5[_0x41f34f(0x195)]===0x0){var _0x41ef20=_0x4dfb4c[_0x41f34f(0x182)]['split']('\x20');if(_0x41ef20[_0x41f34f(0x195)]>0x3)return searchBox(_0x41ef20[_0x41f34f(0x197)](0x0,0x3)[_0x41f34f(0x188)]('\x20'))[_0x41f34f(0x17a)](function(_0x56220a){var _0x4c2235=_0x41f34f,_0x3298d7=findMatches(_0x56220a,_0x4dfb4c[_0x4c2235(0x182)],_0x4dfb4c['year'],_0x4dfb4c[_0x4c2235(0x19b)]);return processMatches(_0x3298d7,_0x4dfb4c,_0x3efb30,_0xd5ed8a);});return[];}return processMatches(_0x3b86f5,_0x4dfb4c,_0x3efb30,_0xd5ed8a);});});}module[_0x553e2c(0x185)]={'getStreams':getStreams};

// __DOOM_SEEKABLE_VALIDATION__
var __doomProbeCache = Object.create(null);
var __doomProbeCacheTtlMs = 10 * 60 * 1000;
var __doomProbeTimeoutMs = 6 * 1000;

function __doomMergeHeaders(base, extra) {
  var merged = {};
  var key;
  for (key in base || {}) merged[key] = base[key];
  for (key in extra || {}) merged[key] = extra[key];
  return merged;
}

function __doomWithTimeout(promise, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, timeoutMs);

    Promise.resolve(promise).then(function(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, function(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function __doomLooksLikeHls(url, contentType) {
  var normalizedUrl = String(url || "").toLowerCase();
  var normalizedType = String(contentType || "").toLowerCase();
  return normalizedUrl.indexOf(".m3u8") !== -1
    || normalizedType.indexOf("mpegurl") !== -1
    || normalizedType.indexOf("application/x-mpegurl") !== -1
    || normalizedType.indexOf("vnd.apple.mpegurl") !== -1;
}

function __doomBuildProbeCacheKey(stream) {
  var headers = stream && stream.headers ? stream.headers : {};
  return [
    stream && stream.url ? stream.url : "",
    headers.Referer || headers.referer || "",
    headers.Origin || headers.origin || ""
  ].join("|");
}

function __doomGetCachedProbeResult(cacheKey) {
  var entry = __doomProbeCache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > __doomProbeCacheTtlMs) {
    delete __doomProbeCache[cacheKey];
    return null;
  }
  return entry.ok;
}

function __doomSetCachedProbeResult(cacheKey, ok) {
  __doomProbeCache[cacheKey] = {
    ok: !!ok,
    timestamp: Date.now()
  };
}

function __doomResponseIsSeekable(response, url) {
  if (!response || !response.ok) return false;
  var headers = response.headers;
  var contentType = headers && headers.get ? headers.get("content-type") || "" : "";
  if (__doomLooksLikeHls(url, contentType)) return true;
  var acceptRanges = headers && headers.get ? headers.get("accept-ranges") || "" : "";
  var contentRange = headers && headers.get ? headers.get("content-range") || "" : "";
  return response.status === 206
    || /bytes/i.test(acceptRanges)
    || /^bytes\s+/i.test(contentRange);
}

function __doomProbeStream(stream) {
  if (!stream || !stream.url || typeof fetch !== "function") {
    return Promise.resolve(false);
  }

  var cacheKey = __doomBuildProbeCacheKey(stream);
  var cached = __doomGetCachedProbeResult(cacheKey);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  var url = stream.url;
  var isHls = __doomLooksLikeHls(url, "");
  var baseHeaders = __doomMergeHeaders({}, stream.headers || {});
  var rangedHeaders = __doomMergeHeaders({}, baseHeaders);
  if (!isHls && !rangedHeaders.Range && !rangedHeaders.range) {
    rangedHeaders.Range = "bytes=0-1";
  }

  var attempts = [
    { method: "GET", headers: isHls ? baseHeaders : rangedHeaders, redirect: "follow" },
    { method: "HEAD", headers: baseHeaders, redirect: "follow" }
  ];

  function tryAttempt(index) {
    if (index >= attempts.length) return Promise.resolve(false);
    return __doomWithTimeout(fetch(url, attempts[index]), __doomProbeTimeoutMs)
      .then(function(response) {
        if (__doomResponseIsSeekable(response, url)) return true;
        return tryAttempt(index + 1);
      })
      .catch(function() {
        return tryAttempt(index + 1);
      });
  }

  return tryAttempt(0).then(function(ok) {
    __doomSetCachedProbeResult(cacheKey, ok);
    return ok;
  });
}

function __doomFilterSeekableStreams(streams, providerLabel) {
  if (!Array.isArray(streams) || streams.length === 0) {
    return Promise.resolve([]);
  }

  return Promise.all(streams.map(function(stream) {
    return __doomProbeStream(stream)
      .then(function(ok) { return { stream: stream, ok: ok }; })
      .catch(function() { return { stream: stream, ok: false }; });
  })).then(function(results) {
    var filtered = results.filter(function(item) { return item.ok; }).map(function(item) { return item.stream; });
    var label = providerLabel || "[Doom-addon]";
    if (filtered.length === 0) {
      console.log(label + " Seekable filter kept 0/" + streams.length + " streams; returning original streams as fallback");
      return streams;
    }
    console.log(label + " Seekable filter kept " + filtered.length + "/" + streams.length + " streams");
    return filtered;
  });
}

(function() {
  if (typeof getStreams !== "function" || getStreams.__doomSeekableWrapped) {
    return;
  }

  var __doomOriginalGetStreams = getStreams;
  var __doomProviderLabel = typeof PLUGIN_TAG !== "undefined"
    ? PLUGIN_TAG
    : (typeof TAG !== "undefined" ? TAG : "[Doom-addon]");

  var __doomWrappedGetStreams = function() {
    return Promise.resolve(__doomOriginalGetStreams.apply(this, arguments))
      .then(function(streams) {
        return __doomFilterSeekableStreams(streams, __doomProviderLabel);
      })
      .catch(function(error) {
        var message = error && error.message ? error.message : String(error);
        console.error(__doomProviderLabel + " Seekable validation failed: " + message);
        return [];
      });
  };

  __doomWrappedGetStreams.__doomSeekableWrapped = true;
  getStreams = __doomWrappedGetStreams;

  if (typeof module !== "undefined" && module.exports) {
    module.exports.getStreams = getStreams;
  } else if (typeof global !== "undefined") {
    global.getStreams = getStreams;
  }
})();

// __DOOM_STREAM_NORMALIZATION__
function __doomNormalizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return null;
  var normalized = {};
  var key;
  for (key in headers) {
    if (headers[key] !== undefined && headers[key] !== null && headers[key] !== "") {
      normalized[key] = String(headers[key]);
    }
  }
  return Object.keys(normalized).length ? normalized : null;
}

function __doomLooksWebReady(url) {
  var normalized = String(url || "").toLowerCase();
  return normalized.indexOf("https://") === 0
    && (normalized.indexOf(".mp4") !== -1 || normalized.indexOf("format=mp4") !== -1);
}

function __doomNormalizeStream(rawStream) {
  if (!rawStream || typeof rawStream !== "object") return null;
  var targetUrl = rawStream.url || rawStream.externalUrl;
  if (!targetUrl || typeof targetUrl !== "string") return null;

  var requestHeaders = __doomNormalizeHeaders(rawStream.headers);
  var behaviorHints = {};
  var key;
  for (key in rawStream.behaviorHints || {}) behaviorHints[key] = rawStream.behaviorHints[key];

  if (rawStream.fileName && !behaviorHints.filename) behaviorHints.filename = rawStream.fileName;
  if (typeof rawStream.size === "number" && rawStream.size > 0 && !behaviorHints.videoSize) {
    behaviorHints.videoSize = rawStream.size;
  }
  if (typeof rawStream.videoSize === "number" && rawStream.videoSize > 0 && !behaviorHints.videoSize) {
    behaviorHints.videoSize = rawStream.videoSize;
  }
  if (!behaviorHints.bingeGroup) {
    var providerId = typeof PLUGIN_TAG !== "undefined" ? PLUGIN_TAG : (typeof TAG !== "undefined" ? TAG : "doom-addon");
    behaviorHints.bingeGroup = String(providerId).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }
  if (!__doomLooksWebReady(targetUrl) || requestHeaders) behaviorHints.notWebReady = true;
  if (requestHeaders) behaviorHints.proxyHeaders = { request: requestHeaders };

  var description = rawStream.description || rawStream.title || rawStream.name || "Doom-addon stream";
  return {
    name: rawStream.name || "Doom-addon",
    title: description,
    description: description,
    url: targetUrl,
    behaviorHints: behaviorHints
  };
}

(function() {
  if (typeof getStreams !== "function" || getStreams.__doomNormalizedWrapped) return;

  var __doomOriginalGetStreamsForNormalization = getStreams;
  var __doomNormalizedGetStreams = function() {
    return Promise.resolve(__doomOriginalGetStreamsForNormalization.apply(this, arguments))
      .then(function(streams) {
        if (!Array.isArray(streams)) return [];
        return streams.map(__doomNormalizeStream).filter(Boolean);
      });
  };

  __doomNormalizedGetStreams.__doomNormalizedWrapped = true;
  getStreams = __doomNormalizedGetStreams;

  if (typeof module !== "undefined" && module.exports) {
    module.exports.getStreams = getStreams;
  } else if (typeof global !== "undefined") {
    global.getStreams = getStreams;
  }
})();
