class JavaError extends Error {
  public buffer: ArrayBuffer;
  public position: number;

  constructor(buffer: ArrayBuffer, position: number, message: string) {
    super(message);

    this.buffer = buffer;
    this.position = position;
  }
}

export class JavaReader {
  private buffer: ArrayBuffer;
  private view: DataView;
  private position: number = 0;
  private count: number = 0;
  private result: { [key: string]: any } | null = null;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.checkMagic();
    this.checkVersion();
    this.position = 0x4d;
    this.count = this.u32();
  }

  collect() {
    if (this.result != null) {
      return this.result;
    }

    this.result = {};

    for (let i = 0; i < this.count; ++i) {
      let keyType = this.u8();

      if (keyType != 0x74) {
        throw new JavaError(
          this.buffer,
          this.position,
          `Unsupported key type 0x${keyType.toString(16)}`
        );
      }

      let key = this.utf();

      if (this.result[key]) {
        throw new JavaError(
          this.buffer,
          this.position,
          `Key "${key}" exists more than once`
        );
      }

      let valueType = this.u8();

      if (valueType != 0x74) {
        throw new JavaError(
          this.buffer,
          this.position,
          `Unsupported value type 0x${valueType.toString(16)}`
        );
      }

      let value = JSON.parse(this.utf());

      this.result[key] = value;
    }

    return this.result;
  }

  private step(length: number) {
    let pos = this.position;

    this.position += length;

    if (this.position > this.buffer.byteLength) {
      throw new JavaError(this.buffer, this.position, "Unexpected end of file");
    }

    return pos;
  }

  private chunk(length: number, encoding: BufferEncoding) {
    const decoder = new TextDecoder(encoding);
    let pos = this.step(length);

    return decoder.decode(this.buffer.slice(pos, this.position));
  }

  private u8() {
    return this.view.getUint8(this.step(1));
  }

  private u16() {
    return this.view.getUint16(this.step(2), false);
  }

  private u32() {
    return this.view.getUint32(this.step(4), false);
  }

  private utf() {
    return this.chunk(this.u16(), "utf-8");
  }

  private checkMagic() {
    if (this.u16() != 0xaced) {
      throw new JavaError(this.buffer, this.position, "STREAM_MAGIC not found");
    }
  }

  private checkVersion() {
    if (this.u16() != 5) {
      throw new JavaError(this.buffer, this.position, "VERSION not supported");
    }
  }
}
