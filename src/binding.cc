
#include <stdlib.h>
#include <errno.h>

#include <v8.h>
#include <node.h>
#include <node_buffer.h>

#include "nan.h"

#ifdef _WIN32
  #define __alignof__ __alignof
  #define snprintf _snprintf_s
  #define strtoll _strtoi64
  #define strtoull _strtoui64
  #define PRId64 "lld"
  #define PRIu64 "llu"
#else
  #define __STDC_FORMAT_MACROS
  #include <inttypes.h>
#endif


using namespace v8;
using namespace node;

namespace {

// used by the Int64 functions to determine whether to return a Number
// or String based on whether or not a Number will loose precision.
// http://stackoverflow.com/q/307179/376773
#define JS_MAX_INT +9007199254740992LL
#define JS_MIN_INT -9007199254740992LL


/*
 * Returns the pointer address as a Number of the given Buffer instance
 *
 * args[0] - Buffer - the Buffer instance get the memory address of
 * args[1] - Number - optional (0) - the offset of the Buffer start at
 */

NAN_METHOD(Address) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("address: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;
  intptr_t intptr = (intptr_t)ptr;
  Local<Number> rtn = Number::New(static_cast<double>(intptr));

  NanReturnValue(rtn);
}

/*
 * Returns "true" if the given Buffer points to NULL, "false" otherwise.
 *
 * args[0] - Buffer - the Buffer instance to check for NULL
 * args[1] - Number - optional (0) - the offset of the Buffer start at
 */

NAN_METHOD(IsNull) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("isNull: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;
  Handle<Value> rtn = Boolean::New(ptr == NULL);

  NanReturnValue(rtn);
}

/**
 * Returns the machine endianness as C String; either "BE" or "LE".
 */

const char *CheckEndianness() {
  int i = 1;
  bool is_bigendian = (*(char *)&i) == 0;
  if (is_bigendian) {
    return "BE";
  } else {
    return "LE";
  }
}

/*
 * A callback that should never be invoked since the NULL pointer
 * wrapper Buffer should never be collected
 */

void unref_null_cb(char *data, void *hint) {
  assert(0 && "NULL Buffer should never be garbage collected");
}

/*
 * Creates the "null_pointer_buffer" Buffer instance that points to NULL.
 * It has a length of 0 so that you don't accidentally try to deref the NULL
 * pointer in JS-land by doing something like: `ref.NULL[0]`.
 */

Local<Object> WrapNullPointer() {
  size_t buf_size = 0;
  char *ptr = reinterpret_cast<char *>(NULL);
  void *user_data = NULL;
  Local<Object> buf = NanNewBufferHandle(ptr, buf_size, unref_null_cb, user_data);
  //null_pointer_buffer = Persistent<Object>::New(buf);
  return buf;
}

/*
 * Retreives a JS Object instance that was previously stored in
 * the given Buffer instance at the given offset.
 *
 * args[0] - Buffer - the "buf" Buffer instance to read from
 * args[1] - Number - the offset from the "buf" buffer's address to read from
 */

NAN_METHOD(ReadObject) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("readObject: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  if (ptr == NULL) {
    return NanThrowError("readObject: Cannot read from NULL pointer");
  }

  //Handle<Value> rtn = *reinterpret_cast<Persistent<Value>*>(ptr);
  Persistent<Value> prtn = *reinterpret_cast<Persistent<Value>*>(ptr);
  Local<Value> rtn = NanPersistentToLocal(prtn);
  NanReturnValue(rtn);
}

/*
 * Callback function for when the weak persistent object from WriteObject
 * gets garbage collected. We just have to dispose of our weak reference now.
 */

static NAN_WEAK_CALLBACK(void *, write_object_cb) {
  //fprintf(stderr, "write_object_cb\n");
  NAN_WEAK_CALLBACK_OBJECT.Dispose();
  NAN_WEAK_CALLBACK_OBJECT.Clear();
}

/*
 * Writes a Persistent reference to given Object to the given Buffer
 * instance and offset.
 *
 * args[0] - Buffer - the "buf" Buffer instance to write to
 * args[1] - Number - the offset from the "buf" buffer's address to write to
 * args[2] - Object - the "obj" Object which will have a new Persistent reference
 *                    created for the obj, who'se memory address will be written
 */

NAN_METHOD(WriteObject) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("writeObject: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  NanInitPersistent(Value, obj, args[2]);
  //Persistent<Value> obj = Persistent<Value>::New(args[2]);

  bool persistent = args[3]->BooleanValue();
  if (!persistent) obj.MakeWeak((void **)NULL, write_object_cb);
  //if (!persistent) NanMakeWeak(obj, NULL, write_object_cb);

  *reinterpret_cast<Persistent<Value>*>(ptr) = obj;

  NanReturnUndefined();
}

/*
 * Callback function for when the SlowBuffer created from ReadPointer gets
 * garbage collected. We don't have to do anything; Node frees the Buffer for us.
 */

void read_pointer_cb(char *data, void *hint) {
//static NAN_WEAK_CALLBACK(void*, read_pointer_cb) {
  //fprintf(stderr, "read_pointer_cb\n");
}

/*
 * Reads the memory address of the given "buf" pointer Buffer at the specified
 * offset, and returns a new SlowBuffer instance from the memory address stored.
 *
 * args[0] - Buffer - the "buf" Buffer instance to read from
 * args[1] - Number - the offset from the "buf" buffer's address to read from
 * args[2] - Number - the length in bytes of the returned SlowBuffer instance
 */

NAN_METHOD(ReadPointer) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("readPointer: Buffer instance expected as first argument");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;
  size_t size = args[2]->Uint32Value();

  if (ptr == NULL) {
    return NanThrowError("readPointer: Cannot read from NULL pointer");
  }

  char *val = *reinterpret_cast<char **>(ptr);
  void *user_data = NULL;
  Local<Object> rtn_buf = NanNewBufferHandle(val, size, read_pointer_cb, user_data);
  //Buffer *rtn_buf = Buffer::New(val, size, read_pointer_cb, NULL);
  NanReturnValue(rtn_buf);
  //return scope.Close(rtn_buf);
}

/*
 * Writes the memory address of the "input" buffer (and optional offset) to the
 * specified "buf" buffer and offset. Essentially making "buf" hold a reference
 * to the "input" Buffer.
 *
 * args[0] - Buffer - the "buf" Buffer instance to write to
 * args[1] - Number - the offset from the "buf" buffer's address to write to
 * args[2] - Buffer - the "input" Buffer whose memory address will be written
 */

NAN_METHOD(WritePointer) {
  NanScope();

  Local<Value> buf = args[0];
  Local<Value> input = args[2];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("writePointer: Buffer instance expected as first argument");
  }
  if (!(input->IsNull() || Buffer::HasInstance(input))) {
    return NanThrowTypeError("writePointer: Buffer instance expected as third argument");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  if (input->IsNull()) {
    *reinterpret_cast<char **>(ptr) = NULL;
  } else {
    char *input_ptr = Buffer::Data(input.As<Object>());
    *reinterpret_cast<char **>(ptr) = input_ptr;
  }

  NanReturnUndefined();
}

/*
 * Reads a machine-endian int64_t from the given Buffer at the given offset.
 *
 * args[0] - Buffer - the "buf" Buffer instance to read from
 * args[1] - Number - the offset from the "buf" buffer's address to read from
 */

NAN_METHOD(ReadInt64) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("readInt64: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  if (ptr == NULL) {
    return NanThrowError("readInt64: Cannot read from NULL pointer");
  }

  int64_t val = *reinterpret_cast<int64_t *>(ptr);

  Local<Value> rtn;
  if (val < JS_MIN_INT || val > JS_MAX_INT) {
    // return a String
    char strbuf[128];
    snprintf(strbuf, 128, "%" PRId64, val);
    rtn = String::New(strbuf);
  } else {
    // return a Number
    rtn = Number::New(static_cast<double>(val));
  }

  NanReturnValue(rtn);
}

/*
 * Writes the input Number/String int64 value as a machine-endian int64_t to
 * the given Buffer at the given offset.
 *
 * args[0] - Buffer - the "buf" Buffer instance to write to
 * args[1] - Number - the offset from the "buf" buffer's address to write to
 * args[2] - String/Number - the "input" String or Number which will be written
 */

NAN_METHOD(WriteInt64) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("writeInt64: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  Local<Value> in = args[2];
  int64_t val;
  if (in->IsNumber()) {
    val = in->IntegerValue();
  } else if (in->IsString()) {
    // Have to do this because strtoll doesn't set errno to 0 on success :(
    errno = 0;
    String::Utf8Value str(in);
    val = strtoll(*str, NULL, 10);
    // TODO: better error handling; check errno
  } else {
    return NanThrowTypeError("writeInt64: Number/String 64-bit value required");
  }

  *reinterpret_cast<int64_t *>(ptr) = val;

  NanReturnUndefined();
}

/*
 * Reads a machine-endian uint64_t from the given Buffer at the given offset.
 *
 * args[0] - Buffer - the "buf" Buffer instance to read from
 * args[1] - Number - the offset from the "buf" buffer's address to read from
 */

NAN_METHOD(ReadUInt64) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("readUInt64: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  if (ptr == NULL) {
    return NanThrowTypeError("readUInt64: Cannot read from NULL pointer");
  }

  uint64_t val = *reinterpret_cast<uint64_t *>(ptr);

  Handle<Value> rtn;
  if (val > JS_MAX_INT) {
    // return a String
    char strbuf[128];
    snprintf(strbuf, 128, "%" PRIu64, val);
    rtn = String::New(strbuf);
  } else {
    // return a Number
    rtn = Number::New(static_cast<double>(val));
  }

  NanReturnValue(rtn);
}

/*
 * Writes the input Number/String uint64 value as a machine-endian uint64_t to
 * the given Buffer at the given offset.
 *
 * args[0] - Buffer - the "buf" Buffer instance to write to
 * args[1] - Number - the offset from the "buf" buffer's address to write to
 * args[2] - String/Number - the "input" String or Number which will be written
 */

NAN_METHOD(WriteUInt64) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("writeUInt64: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  Local<Value> in = args[2];
  uint64_t val;
  if (in->IsNumber()) {
    val = in->IntegerValue();
  } else if (in->IsString()) {
    // Have to do this because strtoull doesn't set errno to 0 on success :(
    errno = 0;
    String::Utf8Value str(in);
    val = strtoull(*str, NULL, 10);
    // TODO: better error handling; check errno
  } else {
    return NanThrowTypeError("writeUInt64: Number/String 64-bit value required");
  }

  *reinterpret_cast<uint64_t *>(ptr) = val;

  NanReturnUndefined();
}

/*
 * Reads a Utf8 C String from the given pointer at the given offset (or 0).
 * I didn't want to add this function but it ends up being necessary for reading
 * past a 0 or 1 length Buffer's boundary in node-ffi :\
 *
 * args[0] - Buffer - the "buf" Buffer instance to read from
 * args[1] - Number - the offset from the "buf" buffer's address to read from
 */

NAN_METHOD(ReadCString) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("readCString: Buffer instance expected");
  }

  int64_t offset = args[1]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  if (ptr == NULL) {
    return NanThrowError("readCString: Cannot read from NULL pointer");
  }

  Handle<Value> rtn = String::New(ptr);
  NanReturnValue(rtn);
}

/*
 * Returns a new Buffer instance that has the same memory address
 * as the given buffer, but with the specified size.
 *
 * args[0] - Buffer - the "buf" Buffer instance to read the address from
 * args[1] - Number - the size in bytes that the returned Buffer should be
 * args[2] - Number - the offset from the "buf" buffer's address to read from
 */

NAN_METHOD(ReinterpretBuffer) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("reinterpret: Buffer instance expected");
  }

  int64_t offset = args[2]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  if (ptr == NULL) {
    return NanThrowError("reinterpret: Cannot reinterpret from NULL pointer");
  }

  size_t size = args[1]->Uint32Value();

  Local<Object> rtn = NanNewBufferHandle(ptr, size, read_pointer_cb, NULL);
  //Buffer *rtn = Buffer::New(ptr, size, read_pointer_cb, NULL);

  NanReturnValue(rtn);
}

/*
 * Returns a new Buffer instance that has the same memory address
 * as the given buffer, but with a length up to the first aligned set of values of
 * 0 in a row for the given length.
 *
 * args[0] - Buffer - the "buf" Buffer instance to read the address from
 * args[1] - Number - the number of sequential 0-byte values that need to be read
 * args[2] - Number - the offset from the "buf" buffer's address to read from
 */

NAN_METHOD(ReinterpretBufferUntilZeros) {
  NanScope();

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return NanThrowTypeError("reinterpretUntilZeros: Buffer instance expected");
  }

  int64_t offset = args[2]->IntegerValue();
  char *ptr = Buffer::Data(buf.As<Object>()) + offset;

  if (ptr == NULL) {
    return NanThrowError("reinterpretUntilZeros: Cannot reinterpret from NULL pointer");
  }

  uint32_t numZeros = args[1]->Uint32Value();
  uint32_t i = 0;
  size_t size = 0;
  bool end = false;

  while (!end && size < 10000) {
    end = true;
    for (i = 0; i < numZeros; i++) {
      if (ptr[size + i] != 0) {
        end = false;
        break;
      }
    }
    if (!end) {
      size += numZeros;
    }
  }

  Local<Object> rtn = NanNewBufferHandle(ptr, size, read_pointer_cb, NULL);
  //Buffer *rtn = Buffer::New(ptr, size, read_pointer_cb, NULL);

  NanReturnValue(rtn);
}


} // anonymous namespace

void init (Handle<Object> target) {
  NanScope();

  // "sizeof" map
  Local<Object> smap = Object::New();
  // fixed sizes
  smap->Set(NanSymbol("int8"),      Integer::New(sizeof(int8_t)));
  smap->Set(NanSymbol("uint8"),     Integer::New(sizeof(uint8_t)));
  smap->Set(NanSymbol("int16"),     Integer::New(sizeof(int16_t)));
  smap->Set(NanSymbol("uint16"),    Integer::New(sizeof(uint16_t)));
  smap->Set(NanSymbol("int32"),     Integer::New(sizeof(int32_t)));
  smap->Set(NanSymbol("uint32"),    Integer::New(sizeof(uint32_t)));
  smap->Set(NanSymbol("int64"),     Integer::New(sizeof(int64_t)));
  smap->Set(NanSymbol("uint64"),    Integer::New(sizeof(uint64_t)));
  smap->Set(NanSymbol("float"),     Integer::New(sizeof(float)));
  smap->Set(NanSymbol("double"),    Integer::New(sizeof(double)));
  // (potentially) variable sizes
  smap->Set(NanSymbol("bool"),      Integer::New(sizeof(bool)));
  smap->Set(NanSymbol("byte"),      Integer::New(sizeof(unsigned char)));
  smap->Set(NanSymbol("char"),      Integer::New(sizeof(char)));
  smap->Set(NanSymbol("uchar"),     Integer::New(sizeof(unsigned char)));
  smap->Set(NanSymbol("short"),     Integer::New(sizeof(short)));
  smap->Set(NanSymbol("ushort"),    Integer::New(sizeof(unsigned short)));
  smap->Set(NanSymbol("int"),       Integer::New(sizeof(int)));
  smap->Set(NanSymbol("uint"),      Integer::New(sizeof(unsigned int)));
  smap->Set(NanSymbol("long"),      Integer::New(sizeof(long)));
  smap->Set(NanSymbol("ulong"),     Integer::New(sizeof(unsigned long)));
  smap->Set(NanSymbol("longlong"),  Integer::New(sizeof(long long)));
  smap->Set(NanSymbol("ulonglong"), Integer::New(sizeof(unsigned long long)));
  smap->Set(NanSymbol("pointer"),   Integer::New(sizeof(char *)));
  smap->Set(NanSymbol("size_t"),    Integer::New(sizeof(size_t)));
  // size of a Persistent handle to a JS object
  smap->Set(NanSymbol("Object"),    Integer::New(sizeof(Persistent<Object>)));

  // "alignof" map
  Local<Object> amap = Object::New();
  struct int8_s { int8_t a; };
  amap->Set(NanSymbol("int8"),      Integer::New(__alignof__(struct int8_s)));
  struct uint8_s { uint8_t a; };
  amap->Set(NanSymbol("uint8"),     Integer::New(__alignof__(struct uint8_s)));
  struct int16_s { int16_t a; };
  amap->Set(NanSymbol("int16"),     Integer::New(__alignof__(struct int16_s)));
  struct uint16_s { uint16_t a; };
  amap->Set(NanSymbol("uint16"),    Integer::New(__alignof__(struct uint16_s)));
  struct int32_s { int32_t a; };
  amap->Set(NanSymbol("int32"),     Integer::New(__alignof__(struct int32_s)));
  struct uint32_s { uint32_t a; };
  amap->Set(NanSymbol("uint32"),    Integer::New(__alignof__(struct uint32_s)));
  struct int64_s { int64_t a; };
  amap->Set(NanSymbol("int64"),     Integer::New(__alignof__(struct int64_s)));
  struct uint64_s { uint64_t a; };
  amap->Set(NanSymbol("uint64"),    Integer::New(__alignof__(struct uint64_s)));
  struct float_s { float a; };
  amap->Set(NanSymbol("float"),     Integer::New(__alignof__(struct float_s)));
  struct double_s { double a; };
  amap->Set(NanSymbol("double"),    Integer::New(__alignof__(struct double_s)));
  struct bool_s { bool a; };
  amap->Set(NanSymbol("bool"),      Integer::New(__alignof__(struct bool_s)));
  struct char_s { char a; };
  amap->Set(NanSymbol("char"),      Integer::New(__alignof__(struct char_s)));
  struct uchar_s { unsigned char a; };
  amap->Set(NanSymbol("uchar"),     Integer::New(__alignof__(struct uchar_s)));
  struct short_s { short a; };
  amap->Set(NanSymbol("short"),     Integer::New(__alignof__(struct short_s)));
  struct ushort_s { unsigned short a; };
  amap->Set(NanSymbol("ushort"),    Integer::New(__alignof__(struct ushort_s)));
  struct int_s { int a; };
  amap->Set(NanSymbol("int"),       Integer::New(__alignof__(struct int_s)));
  struct uint_s { unsigned int a; };
  amap->Set(NanSymbol("uint"),      Integer::New(__alignof__(struct uint_s)));
  struct long_s { long a; };
  amap->Set(NanSymbol("long"),      Integer::New(__alignof__(struct long_s)));
  struct ulong_s { unsigned long a; };
  amap->Set(NanSymbol("ulong"),     Integer::New(__alignof__(struct ulong_s)));
  struct longlong_s { long long a; };
  amap->Set(NanSymbol("longlong"),  Integer::New(__alignof__(struct longlong_s)));
  struct ulonglong_s { unsigned long long a; };
  amap->Set(NanSymbol("ulonglong"), Integer::New(__alignof__(struct ulonglong_s)));
  struct pointer_s { char *a; };
  amap->Set(NanSymbol("pointer"),   Integer::New(__alignof__(struct pointer_s)));
  struct size_t_s { size_t a; };
  amap->Set(NanSymbol("size_t"),    Integer::New(__alignof__(struct size_t_s)));
  struct Object_s { Persistent<Object> a; };
  amap->Set(NanSymbol("Object"),    Integer::New(__alignof__(struct Object_s)));

  // exports
  target->Set(NanSymbol("sizeof"), smap);
  target->Set(NanSymbol("alignof"), amap);
  target->Set(NanSymbol("endianness"), String::New(CheckEndianness()), static_cast<PropertyAttribute>(ReadOnly|DontDelete));
  target->Set(NanSymbol("NULL"), WrapNullPointer(), static_cast<PropertyAttribute>(ReadOnly|DontDelete));
  NODE_SET_METHOD(target, "address", Address);
  NODE_SET_METHOD(target, "isNull", IsNull);
  NODE_SET_METHOD(target, "readObject", ReadObject);
  NODE_SET_METHOD(target, "writeObject", WriteObject);
  NODE_SET_METHOD(target, "readPointer", ReadPointer);
  NODE_SET_METHOD(target, "writePointer", WritePointer);
  NODE_SET_METHOD(target, "readInt64", ReadInt64);
  NODE_SET_METHOD(target, "writeInt64", WriteInt64);
  NODE_SET_METHOD(target, "readUInt64", ReadUInt64);
  NODE_SET_METHOD(target, "writeUInt64", WriteUInt64);
  NODE_SET_METHOD(target, "readCString", ReadCString);
  NODE_SET_METHOD(target, "reinterpret", ReinterpretBuffer);
  NODE_SET_METHOD(target, "reinterpretUntilZeros", ReinterpretBufferUntilZeros);
}
NODE_MODULE(binding, init);
