console.log("--------------------------------------------------------")

var express = require('express');
var exphbs  = require('express-handlebars');
var fs = require('fs');
var path = require('path');
var bCrypt = require('bcrypt-nodejs');
var mysql = require('mysql');
var formidable = require('formidable');
var hbs = exphbs.create({
	defaultLayout: 'base',
	helpers: {
		switch: function(value, options) {
			this._switch_value_ = value;
    		var html = options.fn(this); // Process the body of the switch block
    		delete this._switch_value_;
    		return html;
		},
		case: function(value, options) {
			if (value == this._switch_value_) {
        		return options.fn(this);
    		}
		},
		times: function(n, block) {
    		var accum = '';
    		for(var i = 0; i < n; ++i) {
       			accum += block.fn(i);
    		}	
   			return accum;
		}
	}
});
var cookieParser = require('cookie-parser');
var session = require('express-session');
var error = require('./helper_modules/error.js');
var app = express();

app.use(cookieParser());
app.use(session({secret: "Shh, its a secret!"}))

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

var salt = "akjdwuk21iuadu2";

var isValidPassword = function(input_pass, table_password){
	return bCrypt.compareSync(input_pass, table_password);
}

// Generates hash using bCrypt
var createHash = function(password){
 return bCrypt.hashSync(password);
}

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "admin",
  database: "assumptionGOC",
  typeCast: function castField( field, useDefaultTypeCasting ) {

        // We only want to cast bit fields that have a single-bit in them. If the field
        // has more than one bit, then we cannot assume it is supposed to be a Boolean.
        if ( ( field.type === "BIT" ) && ( field.length === 1 ) ) {

            var bytes = field.buffer();

            // A Buffer in Node represents a collection of 8-bit unsigned integers.
            // Therefore, our single "bit field" comes back as the bits '0000 0001',
            // which is equivalent to the number 1.
            return( bytes[ 0 ] === 1 );

        }

        return( useDefaultTypeCasting() );

    }
});

app.get('/*.*', function(req, res) {
	var file = req.params['0'] + "." +  req.params['1']
	fs.readFile(file, function(err, data) {
		if(err) {
			hbs.renderView('./views/misc/err.handlebars', {
				error: "404",
				message: "Our team of trained monkeys was unable to find this file",
				layout: "clean"
			}, function (err2, data2) {
			if(err2) {
				console.log(err);
				res.writeHead(500, {'Content-Type': 'text/html'});
				res.write("Internal Server Error");
				return res.end();
			}
		
			res.writeHead(404, {'Content-Type': 'text/html'});
			res.write(data2);
			return res.end();
			});
			return;
		}
		switch(path.extname(file)) {
			case ".png" : {
				res.writeHead(200, {'Content-Type': 'image/png'})
				break;
			}
			case ".ico" : {
				res.writeHead(200, {'Content-Type': 'image/x-image'})
				break;
			}
			case ".css" : {
				res.writeHead(200, {'Content-Type': 'text/css'})
				break;
			}
			case ".pdf" : {
				res.writeHead(200, {'Content-Type': 'application/pdf'})
				break;
			}
			default : {
				res.writeHead(200, {'Content-Type': 'text/plain'})
			}
		}
		res.write(data);
		res.end();
	})
})


app.get('*', function(req, res, next) {
	var sql = "SELECT * FROM pagealerts WHERE address=?"
	var url = req.url.substring(1) != "" ? req.url.substring(1) : "homepage"
	con.query(sql, url, function(err, data) {
		if(data.length != 0) {
			res.locals.alerts = data;
		}
		next()
	})
})

app.get('/', function (req, res) {
	var sql = "SELECT * FROM pictures WHERE slideshow=1 AND pageid IS NULL";
	con.query(sql, function(err, result) {
		if(err) {
			error.show(500, res, "Failed to Query Database")
			console.log(err)
		}		
		var pics = []
		for(var i = 0; i < result.length; i ++) {
			pics.push({loc:"/images/misc/" + (result[i])["location"], name: (result[i])["name"]});
		}
		
		res.render('home/home.handlebars', {
			pics: pics,
			num: pics.length-1,
			login: req.session['login']
		});
	})
});

app.get('/about/council', function(req, res) {
	var sql = "SELECT * FROM council"
	con.query(sql, function(err, result) {
		if(err) {
			error.show(500, res, "Failed to Query Database")
			console.log(err)
		}
		for(var i = 0; i < result.length; i ++) {
			result[i].location = "/images/councilmembers/" + result[i].location
		}

		res.render('about/council', {
			login: req.session['login'],
			people: result
		})
	})
})

app.get('/calendar/bulletin', function(req, res) {
	var sql = "SELECT * FROM bulletins WHERE date > NOW() - INTERVAL 30 DAY ORDER BY date DESC"
	con.query(sql, function(err, data) {
		var primo = data[0]
		var first = {
			url: "/bulletins/" + primo.location
		}
		var rest = []
		for(var i = 1; i < data.length; i ++) {
			rest.push({
				date: formatDate(data[i].date),
				url: "/bulletins/" + data[i].location
			})
		}
		res.render('calendar/bulletin', {
			first: first,
			bulletins: rest,
			login: req.session['login']
		})
	})
})

app.get('/organizations/*', function (req, res) {
	var sql = "SELECT * FROM organizations WHERE url = ?"
	con.query(sql, req.params['0'], function(err, data) {
		if(data.length == 0) {
			error.show(404, res);
			return;
		}
		var org = data[0];
		res.render('organizations/generic', {
			login: req.session['loging'],
			name: org.name,
			desc: org.description,
			placeup: org.imageplace == "up",
			imgsrc: "/images/organizations/" + org.location
		})
	})
})

app.get('/events/*', function (req, res) {
	var sql = "SELECT * FROM events WHERE url = ?"
	con.query(sql, req.params['0'], function(err, data) {
		if(data.length == 0) {
			error.show(404, res);
			return;
		}
		var event = data[0];
		sql = "SELECT * FROM pictures WHERE pageid = " + event.ID + " AND slideshow=1"
			con.query(sql, function(err, result) {
				if(err) {
					error.show(500, res, "Failed to Query Database")
					console.log(err)
				}		
				var pics = []
				for(var i = 0; i < result.length; i ++) {
					pics.push({loc:"/images/misc/" + (result[i])["location"], name: (result[i])["name"]});
				}
				res.render('specialevents/generic', {
					login: req.session['loging'],
					name: event.name,
					desc: event.description,
					pics: pics,
					num: pics.length-1,
			})
		})
		
	})
})

app.get('/*/*', function (req, res) {
	var torender = req.params['0'] + "/" +  req.params['1']
	res.render(torender, {
		login: req.session['login'],
		alerts: res.locals.alerts
	})
})

app.get("/contact-us", function(req, res) {
	res.render("misc/contact", {
		login: req.session['login'],
		alerts: res.locals.alerts
	})
})

app.get('/login', function(req, res) {
	hbs.renderView('./views/misc/login.handlebars', {
		failed: (req.session['failed'] ? true : false),
		un: (req.session['attempted-un'] ? req.session['attempted-un'] : "Enter username"),
	}, function (err, data) {
		if(err) {
			console.log(err);
			res.writeHead(500, {'Content-Type': 'text/html'});
			res.write("Internal Server Error: Could not load page");
			return res.end();
		}
		
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.write(data);

		delete req.session['failed']
		delete req.session['attempted-un']
		return res.end();
	});
})

app.post('/login', function (req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
		var sql = "SELECT * FROM users WHERE username = ?"
		var un = fields['username']
		con.query(sql, [un], function (err, result) {
			if(err) {
				console.log(err);
				res.writeHead(500, {'Content-Type': 'text/html'});
				res.write("Internal Server Error: Could not query database");
				return res.end();
			}
			var input = fields['password'];
			if(result.length == 0) {
				req.session['failed'] = true
				req.session['attempted-un'] = fields['username'];
				return res.redirect('/login');
			}
			var table = result[0]['password'];
			
			if(isValidPassword(input, table.toString())) {
				req.session['login'] = true;
				console.log("logged in");
				res.redirect('/');
			} else {
				req.session['failed'] = true
				req.session['attempted-un'] = fields['username'];
				res.redirect('/login');
			}
				
		})
   });
	
});

app.get("*", function(req, res) {
	error.show(404, res);
})

app.all("*", function(req, res) {
	error.show(400, res, "Bad Request")
})

app.use(function (err, req, res, next) {
	if(err.message.startsWith("Failed to lookup view")) {
		error.show(404, res);
	} else {
		error.show(500, res, err.message)
	}
	console.log(err);
})

app.listen(3000);

function formatDate(date) {
  var monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
  ];

  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();

  return monthNames[monthIndex] + ' ' + day + ', ' + year;
}

console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")