#include <v8.h>
#include <node.h>
#include <node_buffer.h>

using namespace v8;
using namespace node;

namespace {


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



} // anonymous namespace

void init (Handle<Object> target) {
  HandleScope scope;

  NODE_SET_METHOD(target, "address", Address);
}
NODE_MODULE(binding, init);
