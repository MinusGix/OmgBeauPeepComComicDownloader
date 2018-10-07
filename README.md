This is a downloader for http://www.omgbeaupeep.com/comics/ as I wanted The_Sandman for offline reading. (Thus it's only been tested for the sandman).

To use: Simply find the link to the comic (such as http://www.omgbeaupeep.com/comics/The_Sandman/ ) Grab the part between the last two / "The_Sandman"
and in test.js replace "The_Sandman" with "Your_Comic".
Such as:
```
const Omg = require('./index.js');

Omg.grabComic('Richie_Rich');
```

then run it with `node test.js`. It will be outputted in the `output/` folder.
(you must run `npm install` before this)