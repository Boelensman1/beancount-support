{ pkgs ? import <nixpkgs> {} }:

let
  beancount3 = pkgs.callPackage ./beancount3.nix {};
in
pkgs.python3Packages.buildPythonPackage rec {
  pname = "beangulp";
  version = "0.2.0";

  src = pkgs.python3Packages.fetchPypi {
    inherit pname version;
    sha256 = "sha256-XJCMRcYsB8TvrdCwPTzdFFrTteK6tfXyd+AJOliRJBo=";
  };

  nativeBuildInputs = with pkgs; [
    python3Packages.setuptools-scm
  ];

  propagatedBuildInputs = with pkgs.python3Packages; [
    beancount3

    beautifulsoup4
    chardet
    click
    lxml
    python-magic
    # petl
  ];

  meta = with pkgs.lib; {
    description = "Importers Framework for Beancount";
    homepage = "https://github.com/beancount/beangulp";
    license = licenses.gpl2Only;
  };
}

