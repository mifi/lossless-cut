for f in sample-videos/*; do echo -n "$f:   "; ffprobe -show_format -of json -i "$f" | json format.format_name; done 2> /dev/null
