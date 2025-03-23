from PIL import Image

# Open the original JPEG image
img = Image.open("Icon.jpeg")

# Define the required sizes
sizes = [(16, 16), (48, 48), (128, 128)]
filenames = ["icon16.png", "icon48.png", "icon128.png"]

# Convert and save each resized image
for size, filename in zip(sizes, filenames):
    img_resized = img.resize(size)  # No need for Image.ANTIALIAS
    img_resized.save(filename, "PNG")

print("PNG icons generated successfully!")
