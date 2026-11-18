import sys
print("Python:", sys.version)

try:
    import PIL
    from PIL import Image
    print("PIL/Pillow available:", PIL.__version__)
except ImportError:
    print("PIL not available")

try:
    import imageio
    print("imageio available:", imageio.__version__)
except ImportError:
    print("imageio not available")
