//! Minimal std-only JSON reader for the golden-vector parity test.
//!
//! The crypto crate has zero third-party dependencies (DR-CC-02); rather than
//! pull serde into the test surface, this parses the small, well-formed golden
//! file we generate ourselves. Not a general-purpose parser — it handles the
//! subset our generator emits (objects, arrays, strings, finite numbers,
//! booleans). Panics on anything unexpected, which is correct for a test.

#![allow(dead_code)]

#[derive(Debug, Clone)]
pub enum Json {
    Obj(Vec<(String, Json)>),
    Arr(Vec<Json>),
    Str(String),
    Num(f64),
    Bool(bool),
    Null,
}

impl Json {
    pub fn parse(s: &str) -> Json {
        let mut p = Parser {
            b: s.as_bytes(),
            i: 0,
        };
        p.ws();
        let v = p.value();
        p.ws();
        v
    }

    pub fn get(&self, key: &str) -> &Json {
        match self {
            Json::Obj(kvs) => kvs
                .iter()
                .find(|(k, _)| k == key)
                .map(|(_, v)| v)
                .unwrap_or_else(|| panic!("missing key {key}")),
            _ => panic!("get on non-object"),
        }
    }
    pub fn arr(&self) -> &Vec<Json> {
        match self {
            Json::Arr(a) => a,
            _ => panic!("not an array"),
        }
    }
    pub fn str(&self) -> &str {
        match self {
            Json::Str(s) => s,
            _ => panic!("not a string"),
        }
    }
    pub fn num(&self) -> f64 {
        match self {
            Json::Num(n) => *n,
            _ => panic!("not a number"),
        }
    }
    pub fn boolean(&self) -> bool {
        match self {
            Json::Bool(b) => *b,
            _ => panic!("not a bool"),
        }
    }
}

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Parser<'a> {
    fn ws(&mut self) {
        while self.i < self.b.len() && (self.b[self.i] as char).is_whitespace() {
            self.i += 1;
        }
    }
    fn peek(&self) -> u8 {
        self.b[self.i]
    }
    fn value(&mut self) -> Json {
        match self.peek() {
            b'{' => self.object(),
            b'[' => self.array(),
            b'"' => Json::Str(self.string()),
            b't' | b'f' => self.boolean(),
            b'n' => {
                self.i += 4;
                Json::Null
            }
            _ => self.number(),
        }
    }
    fn object(&mut self) -> Json {
        self.i += 1; // {
        let mut kvs = Vec::new();
        self.ws();
        if self.peek() == b'}' {
            self.i += 1;
            return Json::Obj(kvs);
        }
        loop {
            self.ws();
            let key = self.string();
            self.ws();
            assert_eq!(self.peek(), b':', "expected colon");
            self.i += 1;
            self.ws();
            let val = self.value();
            kvs.push((key, val));
            self.ws();
            match self.peek() {
                b',' => {
                    self.i += 1;
                }
                b'}' => {
                    self.i += 1;
                    break;
                }
                c => panic!("unexpected {} in object", c as char),
            }
        }
        Json::Obj(kvs)
    }
    fn array(&mut self) -> Json {
        self.i += 1; // [
        let mut a = Vec::new();
        self.ws();
        if self.peek() == b']' {
            self.i += 1;
            return Json::Arr(a);
        }
        loop {
            self.ws();
            a.push(self.value());
            self.ws();
            match self.peek() {
                b',' => {
                    self.i += 1;
                }
                b']' => {
                    self.i += 1;
                    break;
                }
                c => panic!("unexpected {} in array", c as char),
            }
        }
        Json::Arr(a)
    }
    fn string(&mut self) -> String {
        assert_eq!(self.peek(), b'"', "expected string");
        self.i += 1;
        let mut out = String::new();
        while self.peek() != b'"' {
            let c = self.peek();
            if c == b'\\' {
                self.i += 1;
                let esc = self.peek();
                out.push(match esc {
                    b'"' => '"',
                    b'\\' => '\\',
                    b'/' => '/',
                    b'n' => '\n',
                    b't' => '\t',
                    other => other as char,
                });
            } else {
                out.push(c as char);
            }
            self.i += 1;
        }
        self.i += 1; // closing "
        out
    }
    fn boolean(&mut self) -> Json {
        if self.b[self.i] == b't' {
            self.i += 4;
            Json::Bool(true)
        } else {
            self.i += 5;
            Json::Bool(false)
        }
    }
    fn number(&mut self) -> Json {
        let start = self.i;
        while self.i < self.b.len() {
            let c = self.b[self.i];
            if c == b'-' || c == b'+' || c == b'.' || c == b'e' || c == b'E' || c.is_ascii_digit() {
                self.i += 1;
            } else {
                break;
            }
        }
        let s = std::str::from_utf8(&self.b[start..self.i]).unwrap();
        Json::Num(s.parse().expect("valid number"))
    }
}
