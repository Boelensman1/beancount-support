{ pkgs ? import <nixpkgs> {} }:

let
  beancount3 = pkgs.callPackage ./beancount3.nix {};
in pkgs.python3Packages.buildPythonPackage rec {
  pname = "beanprice";
  version = "0.1.dev0";
  format = "pyproject";

  src = pkgs.fetchFromGitHub {
    owner = "beancount";
    repo = pname;
    rev = "22c3a23e44c8463634e7dc22fc7e9981a70b0673";
    sha256 = "sha256-+bqYnTzZByJlCPUhThM2B9UjgdWzjF21Yiw3fQAZ6k4=";
  };

  nativeBuildInputs = with pkgs; [
    python3Packages.setuptools-scm
  ];

  propagatedBuildInputs = with pkgs.python3Packages; [
    beancount3
  ];

  meta = with pkgs.lib; {
    description = "Daily price quotes fetching library for plain-text accounting ";
    homepage = "https://github.com/beancount/beanprice";
    license = licenses.gpl2Only;
  };
}
