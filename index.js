console.log("--------------------------------------------------------")

var express = require('express');
var exphbs  = require('express-handlebars');
var fs = require('fs');
var path = require('path');
var bCrypt = require('bcrypt-nodejs');
var mysql = require('mysql');
var formidable = require('formidable');
var hbs = exphbs.create();
var cookieParser = require('cookie-parser');
var session = require('express-session');

var app = express();

app.use(cookieParser());
app.use(session({secret: "Shh, its a secret!"}))

app.engine('handlebars', exphbs({defaultLayout: 'base'}));
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
  database: "nodeplayroom",
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
			hbs.renderView('./views/err.handlebars', {
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
			case "png" : {
				res.writeHead(200, {'Content-Type': 'image/png'})
			}
			case "ico" : {
				res.writeHead(200, {'Content-Type': 'image/x-image'})
			}
			case "css" : {
				res.writeHead(200, {'Content-Type': 'text/css'})
			}
			default : {
				res.writeHead(200, {'Content-Type': 'text/plain'})
			}
		}
		res.write(data);
		res.end();
	})
})

app.get('/', function (req, res) {
	var sql = "SELECT * FROM pictures WHERE slideshow=1";
	con.query(sql, function(err, result) {
		if(err) {
			console.log(err);
			res.writeHead(500, {'Content-Type': 'text/html'});
			res.write("Internal Server Error. Could not query database");
			return res.end();
		}		
		var pics = []
		for(var i = 0; i < result.length; i ++) {
			pics.push({loc:"/images/" + (result[i])["location"], name: (result[i])["name"]});
		}
		
		res.render('home/home.handlebars', {
			pics: pics,
			num: pics.length-1,
			login: req.session['login'],
			helpers: {
				'times': function(n, block) {
    						var accum = '';
    						for(var i = 0; i < n; ++i) {
       							accum += block.fn(i);
    						}	
   							return accum;
						}
			}
		});
	})
});

app.get('/*/*', function (req, res) {
	var torender = req.params['0'] + "/" +  req.params['1']
	res.render(torender, {
		login: req.session['login']
	})
})

app.get("*", function(req, res) {
	res.status(404)
	res.write('Page Not found')
	return res.end()
})

app.use(function (err, req, res, next) {
	res.status(404)
	res.write('Page Not found')
	return res.end()
})

app.listen(3000);

console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")