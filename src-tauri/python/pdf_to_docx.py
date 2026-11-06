import sys
from pathlib import Path
from pdf2docx import Converter


def convert_pdf_to_docx(input_path: str, output_path: str):
    input_file = Path(input_path)
    output_file = Path(output_path)

    if not input_file.exists():
        raise FileNotFoundError("Input PDF not found")

    if input_file.suffix.lower() != ".pdf":
        raise ValueError("Input file must be PDF")

    converter = Converter(str(input_file))

    try:
        converter.convert(str(output_file))
    finally:
        converter.close()

    return str(output_file)


if __name__ == "__main__":
    try:
        result = convert_pdf_to_docx(sys.argv[1], sys.argv[2])
        print(result)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)