#include <v8.h>
#include <node.h>
#include <node_buffer.h>

using namespace v8;
using namespace node;

namespace {




/*
 * Sets the given "source" Buffer that has the given buffer as it's argument
 */

Handle<Value> Ref(const Arguments& args) {
  HandleScope scope;

  return Undefined();
}

/*
 * Returns the pointer address as a Number of the given Buffer instance
 *
 * args[0] - Buffer - the Buffer instance get the memory address of
 * args[1] - Number - optional (0) - the offset of the Buffer start at
 */

Handle<Value> Address(const Arguments& args) {
  HandleScope scope;

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return ThrowException(Exception::TypeError(
          String::New("address: Buffer instance expected")));
  }

  size_t address = (size_t)Buffer::Data(buf.As<Object>());
  Local<Number> ret = Number::New(address);

  return scope.Close(ret);
}

/*
 * Returns "true" if the given Buffer points to NULL, "false" otherwise.
 *
 * args[0] - Buffer - the Buffer instance to check for NULL
 * args[1] - Number - optional (0) - the offset of the Buffer start at
 */

Handle<Value> IsNull(const Arguments& args) {
  HandleScope scope;

  Local<Value> buf = args[0];
  if (!Buffer::HasInstance(buf)) {
    return ThrowException(Exception::TypeError(
          String::New("isNull: Buffer instance expected")));
  }

  bool isNull = Buffer::Data(buf.As<Object>()) == NULL;
  Handle<Value> ret = Boolean::New(isNull);

  return scope.Close(ret);
}

void unref_null_cb(char *data, void *hint) {
  assert(0 && "NULL Buffer should never be garbage collected");
}

Persistent<Object> WrapNullPointer () {
  size_t bufSize = 0;
  Buffer *buf = Buffer::New((char *)NULL, bufSize, unref_null_cb, NULL);
  Persistent<Object> bufObj = Persistent<Object>::New(buf->handle_);
  return bufObj;
}


} // anonymous namespace

void init (Handle<Object> target) {
  HandleScope scope;

  // "sizeof" map
  Local<Object> smap = Object::New();
  smap->Set(String::NewSymbol("byte"),      Integer::New(sizeof(unsigned char)));
  smap->Set(String::NewSymbol("int8"),      Integer::New(sizeof(int8_t)));
  smap->Set(String::NewSymbol("uint8"),     Integer::New(sizeof(uint8_t)));
  smap->Set(String::NewSymbol("int16"),     Integer::New(sizeof(int16_t)));
  smap->Set(String::NewSymbol("uint16"),    Integer::New(sizeof(uint16_t)));
  smap->Set(String::NewSymbol("int32"),     Integer::New(sizeof(int32_t)));
  smap->Set(String::NewSymbol("uint32"),    Integer::New(sizeof(uint32_t)));
  smap->Set(String::NewSymbol("int64"),     Integer::New(sizeof(int64_t)));
  smap->Set(String::NewSymbol("uint64"),    Integer::New(sizeof(uint64_t)));
  smap->Set(String::NewSymbol("char"),      Integer::New(sizeof(char)));
  smap->Set(String::NewSymbol("uchar"),     Integer::New(sizeof(unsigned char)));
  smap->Set(String::NewSymbol("short"),     Integer::New(sizeof(short)));
  smap->Set(String::NewSymbol("ushort"),    Integer::New(sizeof(unsigned short)));
  smap->Set(String::NewSymbol("int"),       Integer::New(sizeof(int)));
  smap->Set(String::NewSymbol("uint"),      Integer::New(sizeof(unsigned int)));
  smap->Set(String::NewSymbol("long"),      Integer::New(sizeof(long)));
  smap->Set(String::NewSymbol("ulong"),     Integer::New(sizeof(unsigned long)));
  smap->Set(String::NewSymbol("longlong"),  Integer::New(sizeof(long long)));
  smap->Set(String::NewSymbol("ulonglong"), Integer::New(sizeof(unsigned long long)));
  smap->Set(String::NewSymbol("float"),     Integer::New(sizeof(float)));
  smap->Set(String::NewSymbol("double"),    Integer::New(sizeof(double)));
  smap->Set(String::NewSymbol("pointer"),   Integer::New(sizeof(unsigned char *)));
  //smap->Set(String::NewSymbol("string"),    Integer::New(sizeof(char *)));
  smap->Set(String::NewSymbol("size_t"),    Integer::New(sizeof(size_t)));
  // size of a Persistent handle to a JS object
  smap->Set(String::NewSymbol("Object"),    Integer::New(sizeof(Persistent<Object>)));
  target->Set(String::NewSymbol("sizeof"), smap);

  target->Set(String::NewSymbol("NULL"), WrapNullPointer());

  NODE_SET_METHOD(target, "address", Address);
  NODE_SET_METHOD(target, "isNull", IsNull);
  NODE_SET_METHOD(target, "ref", Ref);
}
NODE_MODULE(binding, init);
