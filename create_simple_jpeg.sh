#!/bin/bash
# Create a simple test JPEG using macOS screencapture
# This will capture a small portion of the screen to create a valid JPEG

# Alternative: Create a solid color image using sips
mkdir -p temp_image
cd temp_image

# Create a blank PNG first
cat << 'PNGEOF' | base64 -d > test.png
iVBORw0KGgoAAAANSUhEUgAAAZAAAAEsCAYAAADtt+XCAAAAAXNSR0IArs4c6QAAIABJREFUeF7t
3Qm8JVV55/FfVXXv7d4bkEVANoHgAmqiEsVdFBWNRqOJxiVxS0aNGjXGZTSaxDjJjEtiTEZNNMYt
GhO3aFwQFVFRERRBEATZ9x76Luecqsx7q05V1Xl1zj19l/u6+/N5+vTt91advzp1zq/eqlNvAQ4c
OOCggw4OCCIgAiIgAiIwYgIC5IhhaTkREAEREIFaQICUBBEQAREQgdEJCJCjZ6Y1RUAEREAEBCJA
EERABERABERgdAIC5OiZaU0REAEREAEBUpJEQAREQAREYHQCAuTomWlNERABERABAVKSREAEREAE
RGB0AgLk6JlpTREQAREQAQFSkkRABERABERgdAIC5OiZaU0REAEREAEBUpJEQAREQAREYHQCAuTo
mWlNERABERABAVKSREAEREAERGB0AgLk6JlpTREQAREQAQFSkkRABERABERgdAIC5OiZaU0REAER
EAEBUpJEQAREQAREYHQCAuTomWlNERABERABAVKSREAEREAERGB0AgLk6JlpTREQAREQAQFSkkRA
BERABERgdAIC5OiZaU0REAEREAEBUpJEQAREQAREYHQCAuTomWlNERABERABAVKSREAEREAERGB0
AgLk6JlpTREQAREQAQFSkkRABERABERgdAIC5OiZaU0REAEREAEBUpJEQAREQAREYHQCAuTomWlN
ERABERCB/wdL
PNGEOF

# Convert PNG to JPEG
sips -s format jpeg test.png --out ../test-bookshelf.jpg 2>/dev/null
cd ..
rm -rf temp_image

if [ -f test-bookshelf.jpg ]; then
  echo "Created test-bookshelf.jpg"
  ls -lh test-bookshelf.jpg
else
  echo "Failed to create test image"
  exit 1
fi
