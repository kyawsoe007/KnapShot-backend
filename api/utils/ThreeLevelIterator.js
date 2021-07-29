module.exports = function ThreeLevelIterator(source){

	return {
		*[Symbol.iterator]() {
            for(var f_key in source){
                if(!source.hasOwnProperty(f_key)) continue;
                var f_val = source[f_key];
                for(var s_key in f_val){
                    if(!f_val.hasOwnProperty(s_key)) continue;
                    var s_val = f_val[s_key];
                    for(var i= 0; i< s_val.length; i++){
                        var t_key = s_val[i];
                        yield {f_key, s_key, t_key};
                    }
                }
            }
  	    }
	}
}