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
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
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

app.all("/manage/*", function(req, res, next) {
	if(!req.session['login']) {
		error.show(401, res, "You must be logged in to view this")
	} else {
		next();
	}
});

app.all("/manage", function(req, res, next) {
	if(!req.session['login']) {
		error.show(401, res, "You must be logged in to view this")
	} else {
		next();
	}
});

app.get("/manage", function(req, res) {
	res.render("manage/managehome", {
		login: req.session['login']
	});
})

app.get("/manage/homepage", function(req, res) {
	var sql = "SELECT * FROM pictures WHERE pageid IS NULL"

	con.query(sql, function(err, result) {
		if(err) {
			console.log(err);
			error.show(500, res, "Could not Query Database")
			return;
		}
		var numrows = result.length/6;
		var indx = 0;
		var imagerow = []
		for(var i = 0; i < numrows; i ++) {
			var cols = []
			for(var j = 0; j < 6 && indx < result.length; j++) {
				cols.push({
					id: (result[indx])["id"],
					loc:"/images/misc/" + (result[indx])["location"], 
					name: (result[indx])["name"],
					in: ((result[indx])["slideshow"])
				});
				indx ++;
			}
			imagerow.push({cols:cols});
		}
		res.render('manage/homepage', {
			imgrows: imagerow,
			login: req.session['login']
		});
	});
})

app.get("/manage/events", function(req, res) {
	var sql = "SELECT * FROM events"
	con.query(sql, function(err, data) {
		if(err) {
			console.log(err);
			error.show(500, res, "Could not Query Database");
			return;
		}
		var eventpics = new Array(data.length);
		var numevents = 0;
		console.log(data.length)
		for(var i = 0; i < data.length; i ++) {
			con.query("SELECT * FROM pictures WHERE pageid = " + data[i].ID, function(err, result) {
				if(err) {
					console.log(err);
					error.show(500, res, "Could not Query Database")
				}
				var numrows = result.length/6;
				var indx = 0;
				var imagerow = []
				var url = data[result[0].pageid-1].url
				for(var i = 0; i < numrows; i ++) {
					var cols = []
					for(var j = 0; j < 6 && indx < result.length; j++) {
						cols.push({
							id: (result[indx])["id"],
							loc:"/images/misc/" + (result[indx])["location"], 
							name: (result[indx])["name"],
							in: ((result[indx])["slideshow"]),
							url: url
						});
						indx ++;
					}
					imagerow.push({cols:cols});
				}
				eventpics.splice(result[0].pageid-1, 0, imagerow);
				numevents ++;
				if(numevents == data.length) {
					events = [];
					for(var j = 0; j < data.length; j++) {
						events.push({
							name: data[j].name,
							url: data[j].url,
							description: data[j].description,
							images: eventpics[j]
						})
					}
					res.render('manage/events', {
						events: events,
						login: req.session['login']
					})
				}
			})
		}
		
	})
})

app.get('/manage/council', function(req, res) {
	var sql = "SELECT * FROM council"
	con.query(sql, function(err, result) {
		if(err) {
			error.show(500, res, "Failed to Query Database")
			console.log(err)
		}
		for(var i = 0; i < result.length; i ++) {
			result[i].location = "/images/councilmembers/" + result[i].location
		}

		res.render('manage/managecouncil', {
			login: req.session['login'],
			people: result
		})
	})
});

app.get('/manage/orgs', function(req, res) {
	var sql = "SELECT * FROM organizations"
	con.query(sql, function(err, result) {
		if(err) {
			error.show(500, res, "Failed to Query Database")
			console.log(err)
		}
		console.log(result.length);
		for(var i = 0; i < result.length; i ++) {
			result[i].location = "/images/organizations/" + result[i].location
			result[i].up = result[i].imageplace == "up"
		}

		res.render('manage/organizations', {
			login: req.session['login'],
			orgs: result
		})
	})
})

app.get('/manage/alerts', function(req, res) {
	var sql = "SELECT * FROM pagealerts"
	con.query(sql, function(err, data) {
		for(var i = 0; i < data.length; i ++) {
			data[i].isInfo = data[i].type == "Info";
			data[i].isWarning = data[i].type == "Warning";
			data[i].isDanger = data[i].type == "Danger";
		}
		console.log(data);
		res.render('manage/alerts', {
			login: req.session['login'],
			pagealerts: data
		})
	})
})

app.post("/manage/council/*/editdesc", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields) {
    	if(err) {
    		console.log(err)
    	}
    	var newdesc = fields.description
    	var role = fields.role
    	var sql = "UPDATE council SET description = ?, role = ? WHERE id = " + req.params['0'];
    	con.query(sql, [newdesc, role], function(err, result) {
    		if(err) {
    			console.log(err)
    			error.show(500, res, "Could Not Query Database")
    			return;
    		}
    		console.log(result);
    		res.redirect("/manage/council")
    	}) 
    })
})

app.post("/manage/events/*/editdesc", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields) {
    	if(err) {
    		console.log(err)
    	}
    	var newdesc = fields.description
    	var sql = "UPDATE events SET description = ? WHERE url = '" + req.params['0'] + "'";
    	con.query(sql, newdesc, function(err, result) {
    		if(err) {
    			console.log(err)
    			error.show(500, res, "Could Not Query Database")
    			return;
    		}
    		res.redirect("/manage/events")
    	}) 
    })
})

app.post("/manage/orgs", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields) {
    	if(err) {
    		console.log(err)
    	}
    	var newdesc = fields.description
    	var imageloc = fields.imageloc
    	var sql = "UPDATE organizations SET description = ?, imageplace = ? WHERE id = " + fields.id;
    	con.query(sql, [newdesc, imageloc], function(err, result) {
    		if(err) {
    			console.log(err)
    			error.show(500, res, "Could Not Query Database")
    			return;
    		}
    		console.log(result);
    		res.redirect("/manage/orgs")
    	}) 
    })
})

app.post("/manage/alerts", function(req, res) {
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields) {
		if(err) {
			console.log(err);
			error.show(500, res, "Could not Parse form");
		}
		console.log(fields.id);
		var id = fields.id;
		var on = fields.on ? 1 : 0
		var sql = "UPDATE pagealerts SET hasalert = ?, alert_text = ?, type = ? WHERE id = " + id;
		con.query(sql, [on, fields.msg, fields.type], function(err, data) {
			if(err) {
				console.log(err);
				error.show(500, res, "Could not query Database")
			}
			res.redirect("/manage/alerts")
		})
	})
})

app.get("/manage/council/delete/*", function(req, res) {
	var sql = "SELECT * FROM council WHERE id = ?"
	con.query(sql, req.params['0'], function(err, result) {
		if(err) {
			console.log(err);
			error.show(500, res, "Could Not Query Database");
			return;
		}
		sql = "SELECT * FROM council WHERE location = ?" 
		con.query(sql, result[0].location, function(err, data) {
			if(err) {
				console.log(err);
				error.show(500, res, "Could not Query Database");
				return;
			}
			if(data.length == 1) {
				fs.unlink(process.cwd() + "/images/councilmembers/" + result[0].location, function(err, ret) {
					if(err) {
						console.log(err);
					}
				})
			}

			sql = "DELETE FROM council WHERE id = ?"
			con.query(sql, req.params['0'], function(err, data) {
				if(err) {
					console.log(err);
					error.show(500, res, "Could not Query Database")
				}
				res.redirect("/manage/council")
			})
		})
	})
});

app.get("/manage/*/delete/*", function(req, res) {
	var sql = "SELECT * FROM pictures WHERE id=?";
	con.query(sql, req.params['1'], function(err, result) {
		if(err) {
			console.log(err)
			error.show(500, res, "Could Not Query Database")
			return;
		}
		sql = "SELECT * FROM pictures WHERE location=?";
		con.query(sql, result[0].location, function(err, data) {
			if(data.length == 1) {
				fs.unlink(process.cwd() + "/images/misc/" + result[0]['location'], function(err, ret) {
					if(err) {
						console.log(err);
					}
				});
			}
			
			var sql2 = "DELETE FROM pictures WHERE id = ?"
			con.query(sql2, req.params['1'], function(err, data){
				if(err) {
					console.log(err)
					error.show(500, res, "Could Not Query Database")
					return;
				}
				console.log(data);
				res.redirect("/manage/" + req.params['0']);
			});
		})
			
	})
})

app.post("/manage/council/upload/*", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
    	if(err) {
			console.log(err);
			error.show(500, res, "Could not parse Form")
			return;
		}
    	var oldpath = files.filetoupload.path;
      	var newpath = process.cwd() + '/images/councilmembers/' + files.filetoupload.name;
      	fs.rename(oldpath, newpath, function (err) {
        	if (err) {
        		console.log(err);
				error.show(500, res, "could not move picture")
				return;
        	}
        	var sql = "UPDATE council SET location = ? WHERE id = " + req.params['0'];
        	con.query(sql, files.filetoupload.name, function(err, result) {
        		if(err) {
        			console.log(err);
        			error.show(500, res, "Could not Query Database")
        			return;
				}
				res.redirect('/manage/council');
        	})
      	});
    })
});

app.post("/manage/orgs/upload", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
    	if(err) {
			console.log(err);
			error.show(500, res, "Could not parse Form")
			return;
		}
    	var oldpath = files.filetoupload.path;
      	var newpath = process.cwd() + '/images/organizations/' + files.filetoupload.name;
      	fs.rename(oldpath, newpath, function (err) {
        	if (err) {
        		console.log(err);
				error.show(500, res, "could not move picture")
				return;
        	}
        	var sql = "UPDATE organizations SET location = ? WHERE ID = " + fields.id;
        	con.query(sql, files.filetoupload.name, function(err, result) {
        		if(err) {
        			console.log(err);
        			error.show(500, res, "Could not Query Database")
        			return;
				}
				res.redirect('/manage/orgs');
        	})
      	});
    })
});

app.post("/manage/bulletin", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
    	if(err) {
			console.log(err);
			error.show(500, res, "Could not parse Form")
			return;
		}
    	var oldpath = files.filetoupload.path;
      	var newpath = process.cwd() + '/bulletins/' + files.filetoupload.name;
      	fs.rename(oldpath, newpath, function (err) {
        	if (err) {
        		console.log(err);
				error.show(500, res, "could not move picture")
				return;
        	}
        	var sql = "INSERT INTO bulletins (date, location) VALUES ?";
        	var values = [
        		[fields.date, files.filetoupload.name]
        	]
        	console.log()
        	con.query(sql, [values], function(err, result) {
        		if(err) {
        			console.log(err);
        			error.show(500, res, "Could not Query Database")
        			return;
				}
				res.redirect('/manage/bulletin');
        	})
      	});
    })
});

app.post("/manage/council/new", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
    	if(err) {
			console.log(err);
			error.show(500, res, "Could not parse Form")
			return;
		}
    	var oldpath = files.filetoupload.path;
      	var newpath = process.cwd() + '/images/councilmembers/' + files.filetoupload.name;
      	fs.rename(oldpath, newpath, function (err) {
        	if (err) {
        		console.log(err);
				error.show(500, res, "could not move picture")
				return;
        	}
        	var sql = "INSERT INTO council (name, role, description, location) VALUES ?";
        	var values = [
        		[fields.name, fields.role, fields.description, files.filetoupload.name]
        	]
        	con.query(sql, [values], function(err, result) {
        		if(err) {
        			console.log(err);
        			error.show(500, res, "Could not Query Database")
        			return;
				}
				res.redirect('/manage/council');
        	})
      	});
    })
})

app.post("/manage/alerts/new", function(req, res) {
	var form = formidable.IncomingForm();
	form.parse(req, function(err, fields) {
		if(err) {
			console.log(err);
			error.show(500, res, "Could not Parse Form")
			return;
		}
		var sql = "INSERT INTO pagealerts (address, hasalert, alert_text, type) VALUES ?";
		var values = [
			[fields.url, (fields.on ? 1 : 0), fields.msg, fields.type]
		]
		con.query(sql, [values], function(err, data) {
			if(err) {
				console.log(err);
				error.show(500, res, "Could not query database");
			}
			res.redirect("/manage/alerts")
		})
	})
})

app.get("/manage/*/movedown/*", function(req, res) {
	var sql = "SELECT id FROM " + req.params['0'] +  " WHERE id > " + req.params['1'] + " ORDER BY id ASC";
	con.query(sql, function(err, data) {
		if(err) {
			console.log(err);
			error.show(500, res, "Could not query database");
			return;
		}
		var id = req.params['1'];
		var id2 = data[0].id;
		var updateSQL = "UPDATE council SET id = ? WHERE id = ?"
		con.query(updateSQL, ["-"+id, id], function(err, data) {
			con.query(updateSQL, ["-"+id2, id2], function(err, data) {
				con.query(updateSQL, [id2, "-"+id], function(err, data) {
					con.query(updateSQL, [id, "-"+id2], function(err, data) {
						res.redirect('/manage/council')
					})
				})
			})
		});
	})
});

app.get("/manage/*/moveup/*", function(req, res) {
	var sql = "SELECT id FROM " + req.params['0'] +  " WHERE id < " + req.params['1'] + " ORDER BY id DESC";
	con.query(sql, function(err, data) {
		if(err) {
			console.log(err);
			error.show(500, res, "Could not query database");
			return;
		}
		var id = req.params['1'];
		var id2 = data[0].id;
		var updateSQL = "UPDATE council SET id = ? WHERE id = ?"
		con.query(updateSQL, ["-"+id, id], function(err, data) {
			con.query(updateSQL, ["-"+id2, id2], function(err, data) {
				con.query(updateSQL, [id2, "-"+id], function(err, data) {
					con.query(updateSQL, [id, "-"+id2], function(err, data) {
						res.redirect('/manage/council')
					})
				})
			})
		});
	})
});

app.post("/manage/*/upload", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
    	if(err) {
			console.log(err);
			error.show(500, res, "Could not parse Form")
			return;
		}
    	var oldpath = files.filetoupload.path;
      	var newpath = process.cwd() + '/images/misc/' + files.filetoupload.name;
      	fs.rename(oldpath, newpath, function (err) {
        	if (err) {
        		console.log(err);
				error.show(500, res, "could not move picture")
				return;
        	}
        	con.query("SELECT id FROM events WHERE url = ?", req.params['0'], function(err, result) {
        		if(err) {
        			console.log(err);
        			error.show(500, res, "Could not Query Database")
        			return;
        		}
        		var pageid = (result.count == 0) ? 'NULL' : result[0];
        		var sql = "INSERT INTO pictures (name, location, slideshow, pageid) VALUES ?"
        		var values = [
        			[fields['title'], files.filetoupload.name, 1, pageid]
        		]

        		con.query(sql, [values], function(err, result) {
        			if(err) {
        				console.log(err);
        				error.show(500, res, "Could not Query Database")
        				return;
					}
					res.redirect('/manage/' + (result.count == 0) ? 'homepage' : 'events');
        		})
        	})
      	});
    })
});

app.post("/manage/*", function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
    	var all = fields.selected;
    	var selected = [];
    	var i = 0;
    	while(i < all.length) {
    		var curr = all[i];
    		var nxt = (i+1 == all.length) ? null : all[i+1]
    		if(nxt != null && curr.length == nxt.length && curr.substring(0, curr.length-1) == nxt.substring(0, nxt.length-1)){
    			selected.push(['1', curr.substring(0, curr.length-1)])
    			i += 2
    		} else {
    			selected.push(['0', curr.substring(0, curr.length-1)])
    			i ++
    		}
    	}

    	var num = 0;

    	for(var j = 0; j < selected.length; j ++) {
    		sql = "UPDATE pictures SET slideshow = " + selected[j][0] + " WHERE id = " + selected[j][1]
    		con.query(sql, function(err, result) {
    			if(err) {
    				console.log(err);
    				error.show(500, res, "Could not Query database");
    			}
    			num ++;
    			if(num == selected.length) {
    				res.redirect("/manage/" + (req.params['0'] == "homepage" ? "homepage" : "events"));
    			}
    		})	
    	}
    });
});

app.get('/*.*', function(req, res) {
	var file = req.params['0'] + "." +  req.params['1']
	fs.readFile(file, function(err, data) {
		if(err) {
			error.show(500, res, "Our team of trained monkeys was unable to find this file")
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
			case ".js" : {
				res.writeHead(200, {'Content-Type': 'application/javascript'})
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
		
		var sql = "SELECT * FROM bulletins WHERE date > NOW() - INTERVAL 30 DAY ORDER BY date DESC"
		con.query(sql, function(err, data) {
			res.render('home/home.handlebars', {
				pics: pics,
				num: pics.length-1,
				bulletin: "/bulletins/" + data[0].location,
				login: req.session['login']
			});
		})
		
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

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Calendar API.
  authorize(JSON.parse(content), listEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    console.log("hi");
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
var auth;

function listEvents(autho) {
	auth = autho;
  
}

app.get('/calendar/calendar', function(req, res) {
  var calendar = google.calendar('v3');
  calendar.events.list({
    auth: auth,
    calendarId: 'br2mi4vib6ruo73f6k4bv5taoo@group.calendar.google.com',
    timeMin: (new Date()).toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
    } else {
      for (var i = 0; i < events.length; i++) {
      	events[i].date = 0//formatDate(events[i].start);
      }
    }

    res.render('calendar/calendar', {
    	events: events,
    	login: req.session['login'],
    	alerts: res.locals.alerts
    })
  });
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
			login: req.session['login'],
			alerts: res.locals.alerts
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