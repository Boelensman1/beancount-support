{ pkgs ? import <nixpkgs> {} }:

let
  beancount3 = pkgs.callPackage ./beancount3.nix {};
  beanquery = pkgs.callPackage ./beanquery.nix {};
  beangulp = pkgs.callPackage ./beangulp.nix {};
in pkgs.python3Packages.buildPythonPackage rec {
  pname = "fava";
  version = "1.30.1";
  pyproject = true;

  src = pkgs.python3Packages.fetchPypi {
    inherit pname version;
    hash = "sha256-69Wx9/H7nLDPZP9LOUnDJngY9YTCcr+oQ0E6+xeIWPE=";
  };


  postPatch = ''
    substituteInPlace tests/test_cli.py \
      --replace-fail '"fava"' '"${placeholder "out"}/bin/fava"'
  '';

  build-system = [ pkgs.python3Packages.setuptools-scm ];

  propagatedBuildInputs = with pkgs.python3Packages; [
    beanquery
    beangulp
    beancount3
    babel
    cheroot
    click
    flask
    flask-babel
    jaraco-functools
    jinja2
    markdown2
    ply
    simplejson
    werkzeug
    watchfiles
  ];
}

