exports.show = function(errorCode, res, errorMessage=null) {
	res.status = errorCode;
	if(errorMessage != null) {
		res.render('misc/err.handlebars', {
			code: errorCode,
			message: errorMessage
		});
	} else {
		message = ""
		switch (errorCode) {
			case 404:
				message = "The page you were looking for was missing";
				break;
			case 403:
				message = "You are not allowed to access this page";
				break;
			case 500:
				message = "An unknown server error occurred"
				break;
			default:
				message = "An unknown error has occurred"
		}
		res.render('misc/err.handlebars', {
			code: errorCode,
			message: message
		});
	}
	
}