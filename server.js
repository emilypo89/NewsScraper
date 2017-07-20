// ## Instructions

// * Create an app that follows this user story:

//   1. Whenever a user visits your site, the app will scrape stories from a news outlet of your choice. The data should at least include a link to the story and a headline, but feel free to add more content to your database (photos, bylines, and so on).
//   2. Use Cheerio to grab the site content and Mongoose to save it to your MongoDB database. 

//   3. All users can leave comments on the stories you collect. They should also be allowed to delete whatever comments they want removed. All stored comments should be visible to every user.
//   4. You'll need to use Mongoose's model system to associate comments with particular articles. 

// ### Tips

// * Go back to Saturday's activities if you need a refresher on how to partner one model with another.

// * Whenever you scrape a site for stories, make sure an article isn't already represented in your database before saving it; we don't want duplicates. 

// * Don't just clear out your database and populate it with scraped articles whenever a user accesses your site. 
//   * If your app deletes stories every time someone visits, your users won't be able to see any comments except the ones that they post.

// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var methodOverride = require("method-override");
// Requiring our Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");
// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;


// Initialize Express
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Database configuration with mongoose
mongoose.connect("mongodb://localhost/newsScraper");
var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("open", function() {
  console.log("Mongoose connection successful.");
});

// Override with POST having ?_method=DELETE
app.use(methodOverride("_method"));

// Static directory - give you access to the stuff in the public folder
// app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");


// ======
// Routes
// ======

// A GET request to scrape the Smithsonian magazine website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("http://www.smithsonianmag.com/", function(error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    // Now, we grab every h3 within an article tag, and do the following:
    $("h3.headline").each(function(i, element) {

      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this).children("a").text();
      result.link ="http://www.smithsonianmag.com/" + $(this).children("a").attr("href");

      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });

    });
  });
  // Tell the browser that we finished scraping the text
  res.redirect("/");
});

app.get("/", function (req, res) {
	Article.find({}, function(err, doc) {
		if (err) {
			res.send(err);
		}

		else{
			res.render("index", {article: doc} );
		}
	});
});


app.put("/saved/:id", function(req, res) {
  Article.update({_id: req.params.id}, {$set: {saved: true}}, function(err, doc) {
    if (err) {
      res.send(err);
    }
    else {
      res.redirect("/");
    }
  });
});

app.get("/saved", function(req, res) {
  Article.find({saved: true}).populate("notes", 'body').exec(function(err, doc) {
    if (err) {
      res.send(err);
    }
    else {
      res.render("saved", {saved: doc});
    }
  });
});

// New note creation via POST route
app.post("/saved/notes/:id", function(req, res) {
  var newNote = new Note(req.body);
  console.log("new note" + newNote);
  newNote.save(function(error, doc) {
    if (error) {
      res.send(error);
    }
    else {
      Article.findOneAndUpdate({_id: req.params.id}, { $push: { "notes": doc._id } }, { new: true }).exec(function(err, newdoc) {
        if (err) {
          res.send(err);
        }
        else {
          res.redirect("/saved");
        }
      });
    }
  });
});

app.put("/delete/:id", function(req, res) {
  Article.findOneAndUpdate({_id: req.params.id}, {$set: {saved: false}}, function(err, doc) {
    if (err) {
      res.send(err);
    }
    else {
      res.redirect("/saved");
    }
  });
});

app.delete("/saved/delete/:id", function(req, res) {
  Note.remove({_id: req.params.id}, function(err, doc){
    if (err) {
      res.send(err);
    }
    else {
      res.redirect("/saved");
    }
  });
});




// Listen on port 3000
app.listen(3000, function() {
  console.log("App running on port 3000!");
});

