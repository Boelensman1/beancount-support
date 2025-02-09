{ pkgs ? import <nixpkgs> {} }:

let
  beancount3 = pkgs.callPackage ./beancount3.nix {};
  tatsu574 = pkgs.python3Packages.tatsu.overrideAttrs (oldAttrs: rec {
    version = "5.7.4";
    src = pkgs.fetchurl{
      url = "https://github.com/neogeny/TatSu/archive/refs/tags/v5.7.4.tar.gz";
      hash = "sha256-Le3cuAHPT6AfE8TqkBOb/xOKcaheZ1NwxJYv7wBOOeg=";
    };
    postPatch = ''
      substituteInPlace tatsu/_version.py \
      --replace '5.8.4b1' '5.7.4' # why is 5.7.4 release not version 5.7.4???
    '';
  });
in
pkgs.python3Packages.buildPythonPackage rec {
  pname = "beanquery";
  version = "0.1";
  format = "pyproject";

  src = pkgs.fetchFromGitHub {
    owner = "beancount";
    repo = pname;
    rev = "b11309be153906e8161614d052b57ef01f0c7ccc";
    sha256 = "sha256-1+KTUvnqPceRbzY1OZwOSQdK7f78K9kSwtQfI1SUIa8=";
  };

  nativeBuildInputs = with pkgs; [
    python3Packages.setuptools-scm
  ];

  propagatedBuildInputs = with pkgs.python3Packages; [
    beancount3
    tatsu574

    click
    python-dateutil
  ];

  meta = with pkgs.lib; {
    description = "Light-weight SQL Query Tool";
    homepage = "https://github.com/beancount/beanquery";
    license = licenses.gpl2Only;
  };
}

