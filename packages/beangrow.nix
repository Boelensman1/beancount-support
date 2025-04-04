{ pkgs ? import <nixpkgs> {} }:

let
  beancount3 = pkgs.callPackage ./beancount3.nix {};
  beanprice = pkgs.callPackage ./beanprice.nix {};
in pkgs.python3Packages.buildPythonPackage rec {
  pname = "beangrow";
  version = "1.0.1";
  format = "pyproject";

  src = pkgs.fetchFromGitHub {
    owner = "beancount";
    repo = pname;
    rev = "d73fb39fd1ec79e862859f7c6f93ac10250e3c70";
    sha256 = "fXpPnEMrBeTUHbIFvT9hMR9vAgSIpM80EjXxNPw2HYw=";
  };


  nativeBuildInputs = with pkgs; [
    pkg-config
    python3Packages.setuptools-scm
  ];

  propagatedBuildInputs = with pkgs.python3Packages; [
    pip

    numpy
    pandas
    matplotlib
    scipy
    protobuf

    beancount3
    beanprice
  ];

  meta = with pkgs.lib; {
    description = "d73fb39fd1ec79e862859f7c6f93ac10250e3c70";
    homepage = "https://beancount.github.io/";
    license = licenses.gpl2Only;
  };
}

